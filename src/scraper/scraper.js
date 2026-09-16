// ============================================================
// Picasso — Scraper via Electron BrowserWindow
// ============================================================
const { BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { criarLogScraping, atualizarLogScraping, upsertAlunosBatch } = require('../db/database');

// Vamos definir a URL base e caminhos
const BASE_URL = process.env.SYSTEM_URL || 'https://conexao.educacao.rj.gov.br';

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Inicia o processo de scraping de forma invisível.
 * @param {Array} cookies Cookies capturados na janela de login
 */
async function iniciarScraping(cookies) {
  const logId = criarLogScraping();
  let win = null;

  try {
    console.log('[Scraper] Iniciando scraping com BrowserWindow invisível...');
    
    win = new BrowserWindow({
      show: false, // invisível!
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    // 1. Cookies não precisam ser injetados manualmente.
    // Como a janela invisível usa a defaultSession, ela já herda
    // a sessão autenticada da janela de login automaticamente.

    atualizarLogScraping(logId, { status: 'navegando_relatorio', mensagem: 'Acessando relatório de alunos...' });

    // 2. Navegar para a URL do Relatório
    const reportUrl = `${BASE_URL}/ConexaoEducacao/Relatorio/PageViewer.aspx?report=RelAlunosMatPTurma&grp=GESTAO`;
    await win.loadURL(reportUrl);
    
    await delay(5000); 

    let scrapingState = 'SELECT_FILTERS';
    let turmasToScrape = [];
    let allAlunos = [];
    let waitRetries = 0;
    
    atualizarLogScraping(logId, { status: 'extraindo_dados', mensagem: 'Preenchendo filtros de pesquisa (Regional, Escola, etc)...' });

    // 3. Loop da Máquina de Estados
    while (scrapingState !== 'DONE') {
      
      if (scrapingState === 'SELECT_FILTERS') {
        // Checamos o estado atual da página
        const filterState = await win.webContents.executeJavaScript(`
          (() => {
            try {
              const getVal = id => { const el = document.getElementById(id); return el ? el.value : null; };
              const getOpts = id => { 
                const el = document.getElementById(id); 
                if (!el) return [];
                return Array.from(el.options).map(o => ({val: o.value, text: o.text}));
              };
              
              const reg = getVal('rptViewer_ctl00_ctl03_ddValue');
              const mun = getVal('rptViewer_ctl00_ctl05_ddValue');
              const esc = getVal('rptViewer_ctl00_ctl07_ddValue');
              const ano = getVal('rptViewer_ctl00_ctl09_ddValue');
              const sem = getVal('rptViewer_ctl00_ctl11_ddValue');
              const turma = getVal('rptViewer_ctl00_ctl13_ddValue');
              
              const needsSelection = (val) => !val || val === '0' || val === '1' || String(val).includes('Select a Value') || String(val).includes('Selecione');
              
              const pickFirstValid = (opts) => {
                const valid = opts.find(o => !needsSelection(o.val));
                return valid ? valid.val : null;
              };

              // Tentar selecionar do topo para a base
              if (needsSelection(reg)) {
                const opts = getOpts('rptViewer_ctl00_ctl03_ddValue');
                const val = pickFirstValid(opts);
                if (val) return { action: 'select', id: 'rptViewer_ctl00_ctl03_ddValue', name: 'rptViewer$ctl00$ctl03$ddValue', val };
              }
              if (needsSelection(mun)) {
                const opts = getOpts('rptViewer_ctl00_ctl05_ddValue');
                const val = pickFirstValid(opts);
                if (val) return { action: 'select', id: 'rptViewer_ctl00_ctl05_ddValue', name: 'rptViewer$ctl00$ctl05$ddValue', val };
              }
              if (needsSelection(esc)) {
                const opts = getOpts('rptViewer_ctl00_ctl07_ddValue');
                const val = pickFirstValid(opts);
                if (val) return { action: 'select', id: 'rptViewer_ctl00_ctl07_ddValue', name: 'rptViewer$ctl00$ctl07$ddValue', val };
              }
              if (needsSelection(ano)) {
                const opts = getOpts('rptViewer_ctl00_ctl09_ddValue');
                const val = pickFirstValid(opts);
                if (val) return { action: 'select', id: 'rptViewer_ctl00_ctl09_ddValue', name: 'rptViewer$ctl00$ctl09$ddValue', val };
              }
              if (needsSelection(sem)) {
                const opts = getOpts('rptViewer_ctl00_ctl11_ddValue');
                const val = pickFirstValid(opts);
                if (val) return { action: 'select', id: 'rptViewer_ctl00_ctl11_ddValue', name: 'rptViewer$ctl00$ctl11$ddValue', val };
              }
              
              // Se todos os de cima estão selecionados e a Turma tem opções válidas
              const turmaOpts = getOpts('rptViewer_ctl00_ctl13_ddValue').filter(o => !needsSelection(o.val));
              if (turmaOpts.length > 0) {
                return { action: 'done_filters', turmas: turmaOpts };
              }

              return { action: 'wait', html_length: document.body.innerHTML.length }; // Talvez ainda esteja carregando
            } catch (e) {
              return { error: e.message, html_length: 0 };
            }
          })();
        `);

        if (filterState.error) {
          throw new Error('Erro ao injetar script de filtros: ' + filterState.error);
        }

        if (filterState.action === 'select') {
          waitRetries = 0;
          console.log(`[Scraper] Selecionando filtro ${filterState.id} = ${filterState.val}`);
          atualizarLogScraping(logId, { status: 'extraindo_dados', mensagem: `Preenchendo: ${filterState.id}` });
          await win.webContents.executeJavaScript(`
            document.getElementById('${filterState.id}').value = '${filterState.val}';
            __doPostBack('${filterState.name}', '');
          `);
          await delay(4000); // Aguarda o PostBack e o reload da página ASP.NET
        } else if (filterState.action === 'done_filters') {
          waitRetries = 0;
          turmasToScrape = filterState.turmas;
          console.log(`[Scraper] Filtros preenchidos! Encontradas ${turmasToScrape.length} turmas para raspar.`);
          atualizarLogScraping(logId, { status: 'extraindo_dados', mensagem: `Turmas encontradas: ${turmasToScrape.length}. Iniciando...` });
          scrapingState = 'SCRAPE_TURMAS';
        } else {
          // wait
          waitRetries++;
          console.log(`[Scraper] Aguardando elementos da página carregarem (tentativa ${waitRetries}/15)... HTML Length: ${filterState.html_length}`);
          
          if (waitRetries > 15) {
            const htmlCompleto = await win.webContents.executeJavaScript('document.body.innerHTML');
            const debugPath = path.join(require('electron').app.getPath('userData'), 'data', 'debug_report_main.html');
            fs.writeFileSync(debugPath, htmlCompleto, 'utf-8');
            console.log(`\n[Scraper] TIMEOUT! Os filtros não apareceram na página pai. HTML salvo em: ${debugPath}`);
            atualizarLogScraping(logId, { status: 'erro', mensagem: 'Timeout ao aguardar carregamento dos filtros (SSRS).' });
            scrapingState = 'DONE';
            break;
          }
          await delay(2000);
        }
      } 
      
      else if (scrapingState === 'SCRAPE_TURMAS') {
        if (turmasToScrape.length === 0) {
          scrapingState = 'DONE';
          break;
        }

        const turma = turmasToScrape.shift();
        console.log(`[Scraper] Raspando Turma: ${turma.text} (${turma.val}) - Faltam ${turmasToScrape.length}`);
        atualizarLogScraping(logId, { mensagem: `Lendo Turma: ${turma.text}...` });

        // Selecionar a Turma e clicar em View Report
        await win.webContents.executeJavaScript(`
          document.getElementById('rptViewer_ctl00_ctl13_ddValue').value = '${turma.val}';
          document.getElementById('rptViewer_ctl00_ctl00').click();
        `);

        // Aguardar o carregamento do relatório. SSRS demora um pouquinho para renderizar o iframe
        await delay(6000);

        // Ler o iframe
        const iframeState = await win.webContents.executeJavaScript(`
          (() => {
            try {
              const iframe = document.getElementById('ReportFramerptViewer');
              if (!iframe || !iframe.contentDocument) return { error: 'iframe_not_found', html: document.body.innerHTML };
              
              const doc = iframe.contentDocument;
              
              // CSS SELECTORS AINDA FICTÍCIOS
              const trs = doc.querySelectorAll('table tr.aluno-row'); 
              if (trs.length === 0) {
                  return { error: 'table_not_found', html: doc.body.innerHTML };
              }
              
              const alunos = [];
              trs.forEach(tr => {
                const nome = tr.querySelector('.nome')?.innerText.trim();
                const matricula = tr.querySelector('.matricula')?.innerText.trim();
                const turma_nome = tr.querySelector('.turma')?.innerText.trim();
                if (nome && matricula) {
                  alunos.push({ nome, matricula, turma_nome: turma_nome || '${turma.text}' });
                }
              });
              return { error: null, alunos };
            } catch (e) {
              return { error: 'js_exception', html: e.message };
            }
          })();
        `);

        if (iframeState.error === 'table_not_found') {
          const debugPath = path.join(require('electron').app.getPath('userData'), 'data', 'debug_report.html');
          fs.writeFileSync(debugPath, iframeState.html, 'utf-8');
          console.log(`\n=======================================================`);
          console.log(`[Scraper] A tabela de alunos não foi encontrada na Turma ${turma.text}!`);
          console.log(`[Scraper] Eu salvei o HTML do iframe SSRS neste arquivo:`);
          console.log(`[Scraper] -> ${debugPath}`);
          console.log(`[Scraper] Abra esse arquivo, inspecione a estrutura e me passe!`);
          console.log(`=======================================================\n`);
          
          atualizarLogScraping(logId, { status: 'erro', mensagem: 'Tabela de alunos não mapeada. HTML salvo.' });
          scrapingState = 'DONE'; // Interrompe para debug
          break;
        } else if (iframeState.error) {
          console.log('[Scraper] Erro ao ler iframe:', iframeState.error, iframeState.html);
        } else {
          console.log(`[Scraper] Extraídos ${iframeState.alunos.length} alunos da turma ${turma.text}`);
          allAlunos.push(...iframeState.alunos);
        }
      }
    }

    if (allAlunos.length > 0) {
      upsertAlunosBatch(allAlunos);
    }

    if (scrapingState === 'DONE' && allAlunos.length > 0) {
      console.log(`[Scraper] Finalizado! Total: ${allAlunos.length} alunos.`);
      atualizarLogScraping(logId, { 
        status: 'concluido', 
        total_alunos: allAlunos.length, 
        mensagem: 'Scraping concluído com sucesso.' 
      });
    }

  } catch (error) {
    console.error('[Scraper] Erro durante o scraping:', error);
    atualizarLogScraping(logId, { 
      status: 'erro', 
      mensagem: error.message 
    });
  } finally {
    if (win) {
      win.close();
    }
  }
}

module.exports = {
  iniciarScraping
};
