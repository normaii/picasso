// ============================================================
// Picasso — Scraper via Electron BrowserWindow
// ============================================================
const { BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { criarLogScraping, atualizarLogScraping, upsertAlunosBatch } = require('../db/database');

const BASE_URL = process.env.SYSTEM_URL || 'https://conexao.educacao.rj.gov.br';

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Helper para rodar JS no contexto da página e injetar no log.
 * Adicionamos um validador do ciclo de vida do ASP.NET AJAX.
 */
async function waitAspNetReady(win) {
  let retries = 0;
  while (retries < 20) {
    const isReady = await win.webContents.executeJavaScript(`
      (() => {
        try {
          if (typeof Sys !== 'undefined' && Sys.WebForms && Sys.WebForms.PageRequestManager) {
            return !Sys.WebForms.PageRequestManager.getInstance().get_isInAsyncPostBack();
          }
          return true; // Se não tem Sys.WebForms, considera pronto
        } catch(e) { return true; }
      })();
    `);
    if (isReady) return true;
    await delay(1000);
    retries++;
  }
  return false;
}

async function iniciarScraping(cookies) {
  const logId = criarLogScraping();
  let win = null;

  try {
    console.log('[Scraper] Iniciando scraping com BrowserWindow invisível...');
    
    win = new BrowserWindow({
      show: false, // invisível
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    // Como a janela usa a defaultSession, não precisamos reinjetar cookies
    // (ADR-015/019 e mitigação do bug do ASP.NET Session)

    atualizarLogScraping(logId, { status: 'navegando_relatorio', mensagem: 'Acessando relatório de alunos...' });
    
    const reportUrl = `${BASE_URL}/ConexaoEducacao/Relatorio/PageViewer.aspx?report=RelAlunosMatPTurma&grp=GESTAO`;
    await win.loadURL(reportUrl);
    
    await delay(5000); 

    let scrapingState = 'SETUP_FILTERS';
    
    let semestresToScrape = [];
    let currentSemestre = null;
    let turmasToScrape = [];
    let currentTurma = null;
    let allAlunos = [];
    
    let stateRetries = 0;

    const FIELD_NAMES = {
      'rptViewer_ctl00_ctl03_ddValue': 'Regional',
      'rptViewer_ctl00_ctl05_ddValue': 'Município',
      'rptViewer_ctl00_ctl07_ddValue': 'Escola',
      'rptViewer_ctl00_ctl09_ddValue': 'Ano'
    };

    atualizarLogScraping(logId, { status: 'extraindo_dados', mensagem: 'Aguardando inicialização da página...' });

    // ----------------------------------------------------
    // Loop Principal da Máquina de Estados
    // ----------------------------------------------------
    while (scrapingState !== 'DONE') {
      
      // Sempre espera o ASP.NET terminar os processamentos assíncronos (UpdatePanel) antes de agir
      const ready = await waitAspNetReady(win);
      if (!ready) {
        console.log('[Scraper] TIMEOUT! ASP.NET preso em isInAsyncPostBack.');
        atualizarLogScraping(logId, { status: 'erro', mensagem: 'Servidor demorou muito a responder (Timeout ASP.NET).' });
        break;
      }

      if (scrapingState === 'SETUP_FILTERS') {
        const setupState = await win.webContents.executeJavaScript(`
          (() => {
            try {
              const getVal = id => { const el = document.getElementById(id); return el ? el.value : null; };
              const getOpts = id => { 
                const el = document.getElementById(id); 
                if (!el) return [];
                return Array.from(el.options).map(o => ({val: o.value, text: o.text.trim()}));
              };
              
              const isValidOpt = (opt) => {
                if (!opt || !opt.val || opt.val === '0') return false;
                const t = opt.text.toUpperCase();
                if (t.includes('SELECT') || t.includes('SELECIONE')) return false;
                return true;
              };
              
              const pickFirst = (opts) => {
                const valid = opts.find(isValidOpt);
                return valid ? valid : null;
              };

              const regId = 'rptViewer_ctl00_ctl03_ddValue';
              const munId = 'rptViewer_ctl00_ctl05_ddValue';
              const escId = 'rptViewer_ctl00_ctl07_ddValue';
              const anoId = 'rptViewer_ctl00_ctl09_ddValue';

              // Precisamos pegar a lista de options para verificar se o valor ATUAL é válido.
              // Se não for, pegamos a primeira opção válida.
              const regOpts = getOpts(regId);
              const munOpts = getOpts(munId);
              const escOpts = getOpts(escId);
              const anoOpts = getOpts(anoId);
              
              const regCurrent = regOpts.find(o => o.val === getVal(regId));
              if (!isValidOpt(regCurrent)) return { action: 'select', id: regId, opt: pickFirst(regOpts) };
              
              const munCurrent = munOpts.find(o => o.val === getVal(munId));
              if (!isValidOpt(munCurrent)) return { action: 'select', id: munId, opt: pickFirst(munOpts) };
              
              const escCurrent = escOpts.find(o => o.val === getVal(escId));
              if (!isValidOpt(escCurrent)) return { action: 'select', id: escId, opt: pickFirst(escOpts) };
              
              const anoCurrent = anoOpts.find(o => o.val === getVal(anoId));
              if (!isValidOpt(anoCurrent)) return { action: 'select', id: anoId, opt: pickFirst(anoOpts) };
              
              return { action: 'done' };
            } catch (e) {
              return { error: e.message };
            }
          })();
        `);

        if (setupState.error) {
          throw new Error('Erro injetando scripts de setup: ' + setupState.error);
        }

        if (setupState.action === 'select') {
          if (!setupState.opt) {
            stateRetries++;
            if (stateRetries > 5) throw new Error(`Não foi possível achar opção válida para o filtro ${setupState.id}.`);
            await delay(1500);
            continue;
          }
          stateRetries = 0;
          
          const label = FIELD_NAMES[setupState.id] || setupState.id;
          console.log(`[Scraper] Selecionando ${label}...`);
          console.log(`[Scraper] ${label} ${setupState.opt.text} Selecionado(a)...`);
          atualizarLogScraping(logId, { status: 'extraindo_dados', mensagem: `${label} ${setupState.opt.text} Selecionado(a)...` });
          
          await win.webContents.executeJavaScript(`
            (() => {
              const el = document.getElementById('${setupState.id}');
              el.value = '${setupState.opt.val}';
              el.dispatchEvent(new Event('change', { bubbles: true }));
            })();
          `);
          await delay(1000);
        } else if (setupState.action === 'done') {
          console.log('[Scraper] Filtros base preenchidos. Indo capturar semestres...');
          atualizarLogScraping(logId, { status: 'extraindo_dados', mensagem: `Filtros base configurados. Mapeando semestres...` });
          scrapingState = 'FETCH_SEMESTRES';
        }
      } 
      
      else if (scrapingState === 'FETCH_SEMESTRES') {
        const fetchSem = await win.webContents.executeJavaScript(`
          (() => {
            const el = document.getElementById('rptViewer_ctl00_ctl11_ddValue');
            if (!el) return { error: 'Dropdown semestre não encontrado.' };
            const isValid = (t) => {
              const upper = t.toUpperCase();
              return !(upper.includes('SELECT') || upper.includes('SELECIONE'));
            };
            const opts = Array.from(el.options)
                              .filter(o => o.value !== '0' && isValid(o.text))
                              .map(o => ({ val: o.value, text: o.text.trim() }));
            return { sems: opts };
          })();
        `);

        if (fetchSem.error) throw new Error(fetchSem.error);
        
        semestresToScrape = fetchSem.sems;
        console.log(`[Scraper] Encontrados ${semestresToScrape.length} semestres válidos.`);
        scrapingState = 'SELECT_SEMESTRE';
      }

      else if (scrapingState === 'SELECT_SEMESTRE') {
        if (semestresToScrape.length === 0) {
          scrapingState = 'DONE';
          continue;
        }

        currentSemestre = semestresToScrape.shift();
        console.log(`[Scraper] =======================================`);
        console.log(`[Scraper] Selecionando Semestre: ${currentSemestre.text}`);
        atualizarLogScraping(logId, { status: 'extraindo_dados', mensagem: `Analisando Semestre: ${currentSemestre.text}` });

        await win.webContents.executeJavaScript(`
          (() => {
            const el = document.getElementById('rptViewer_ctl00_ctl11_ddValue');
            el.value = '${currentSemestre.val}';
            el.dispatchEvent(new Event('change', { bubbles: true }));
          })();
        `);
        await delay(1000);
        scrapingState = 'FETCH_TURMAS';
      }

      else if (scrapingState === 'FETCH_TURMAS') {
        const fetchTur = await win.webContents.executeJavaScript(`
          (() => {
            const el = document.getElementById('rptViewer_ctl00_ctl13_ddValue');
            if (!el) return { error: 'Dropdown turma não encontrado.' };
            const isValid = (t) => {
              const upper = t.toUpperCase();
              return !(upper.includes('SELECT') || upper.includes('SELECIONE'));
            };
            const opts = Array.from(el.options)
                              .filter(o => o.value !== '0' && isValid(o.text))
                              .map(o => ({ val: o.value, text: o.text.trim() }));
            return { turmas: opts };
          })();
        `);
        
        if (fetchTur.error) throw new Error(fetchTur.error);

        turmasToScrape = fetchTur.turmas;
        if (turmasToScrape.length === 0) {
          console.log(`[Scraper] Semestre ${currentSemestre.text} não possui turmas. Indo para o próximo...`);
          scrapingState = 'SELECT_SEMESTRE';
        } else {
          console.log(`[Scraper] Semestre ${currentSemestre.text} tem ${turmasToScrape.length} turmas mapeadas.`);
          scrapingState = 'SCRAPE_TURMA';
        }
      }

      else if (scrapingState === 'SCRAPE_TURMA') {
        if (turmasToScrape.length === 0) {
          console.log(`[Scraper] Turmas do semestre esgotadas. Voltando para semestres...`);
          scrapingState = 'SELECT_SEMESTRE';
          continue;
        }

        currentTurma = turmasToScrape.shift();
        console.log(`[Scraper] >> Raspando Turma: ${currentTurma.text} (Faltam ${turmasToScrape.length} neste semestre)`);
        atualizarLogScraping(logId, { status: 'extraindo_dados', mensagem: `Extraindo alunos da turma: ${currentTurma.text}` });

        // Seleciona a turma, mas NÃO dispara 'change' pq isso não recarrega o form principal.
        // O SSRS exige clicar no 'View Report' (rptViewer_ctl00_ctl00)
        await win.webContents.executeJavaScript(`
          (() => {
            document.getElementById('rptViewer_ctl00_ctl13_ddValue').value = '${currentTurma.val}';
            document.getElementById('rptViewer_ctl00_ctl00').click();
          })();
        `);
        
        // Iframe load is separate from PageRequestManager.
        await delay(5000); 
        scrapingState = 'WAIT_IFRAME_REPORT';
      }

      else if (scrapingState === 'WAIT_IFRAME_REPORT') {
        const iframeState = await win.webContents.executeJavaScript(`
          (() => {
            try {
              const iframe = document.getElementById('ReportFramerptViewer');
              if (!iframe || !iframe.contentDocument) return { error: 'iframe_not_found', html: document.body.innerHTML };
              
              const doc = iframe.contentDocument;
              
              // A estrutura do SSRS muda as classes CSS (a46, a50) a cada execução.
              // Vamos pegar TODAS as TRs e filtrar aquelas cuja 1ª coluna seja uma matrícula (apenas números, mínimo 10 dígitos)
              const trs = Array.from(doc.querySelectorAll('table tr')).filter(tr => {
                const tds = tr.querySelectorAll('td');
                if (tds.length < 4) return false;
                const txt = tds[0].innerText.trim();
                return /^\\d{10,}$/.test(txt);
              });
              
              if (trs.length === 0) {
                  return { error: 'table_not_found', html: doc.body.innerHTML };
              }
              
              const alunos = [];
              trs.forEach(tr => {
                const tds = tr.querySelectorAll('td');
                const matricula = tds[0].innerText.trim();
                const nome = tds[1].innerText.trim();
                // tds[2] é a Turma original do relatório, mas já temos currentTurma.text
                if (nome && matricula) {
                  alunos.push({ nome, matricula, turma_nome: '${currentTurma.text}' });
                }
              });
              return { error: null, alunos };
            } catch (e) {
              return { error: 'js_exception', html: e.message };
            }
          })();
        `);

        if (iframeState.error === 'table_not_found') {
          const debugPath = path.join(require('electron').app.getPath('userData'), 'data', 'debug_report_iframe.html');
          fs.writeFileSync(debugPath, iframeState.html, 'utf-8');
          console.log(`\n=======================================================`);
          console.log(`[Scraper] A tabela de alunos não foi encontrada na Turma ${currentTurma.text}!`);
          console.log(`[Scraper] Eu salvei o HTML do iframe SSRS neste arquivo:`);
          console.log(`[Scraper] -> ${debugPath}`);
          console.log(`[Scraper] Abra esse arquivo, inspecione a estrutura e me passe!`);
          console.log(`=======================================================\n`);
          
          atualizarLogScraping(logId, { status: 'erro', mensagem: `Tabela de alunos não mapeada. HTML salvo.` });
          scrapingState = 'DONE'; // Interrompe para debug final
          break;
        } else if (iframeState.error) {
          console.log('[Scraper] Erro transitório ao ler iframe, tentando de novo... Error:', iframeState.error);
          await delay(3000);
          // Permanece no mesmo estado WAIT_IFRAME_REPORT
        } else {
          console.log(`[Scraper] Extraídos ${iframeState.alunos.length} alunos da turma ${currentTurma.text}`);
          allAlunos.push(...iframeState.alunos);
          
          // Volta pra próxima turma
          scrapingState = 'SCRAPE_TURMA';
        }
      }
    }

    // Salvar alunos caso tenhamos achado algum
    if (allAlunos.length > 0) {
      upsertAlunosBatch(allAlunos);
    }

    if (scrapingState === 'DONE') {
      console.log(`[Scraper] Processo principal finalizado! Total no buffer: ${allAlunos.length} alunos.`);
      atualizarLogScraping(logId, { 
        status: 'concluido', 
        total_alunos: allAlunos.length, 
        mensagem: 'Sincronização concluída com sucesso!' 
      });
    }

  } catch (error) {
    console.error('[Scraper] Erro catastrófico durante o scraping:', error);
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
