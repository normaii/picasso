// ============================================================
// Picasso — Scraper via Electron BrowserWindow
// ============================================================
const { BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { criarLogScraping, atualizarLogScraping, upsertAlunosBatch } = require('../db/database');

const BASE_URL = process.env.SYSTEM_URL || 'https://conexao.educacao.rj.gov.br';

// Flag global de cancelamento
let cancelRequested = false;

function requestCancel() {
  cancelRequested = true;
}

function isCancelled() {
  return cancelRequested;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Log com timestamp no console.
 */
function log(msg) {
  const ts = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  console.log(`[${ts}] [Scraper] ${msg}`);
}

/**
 * Aguarda o ASP.NET terminar o UpdatePanel async postback.
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
          return true;
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
  cancelRequested = false;
  const logId = criarLogScraping();
  let win = null;

  try {
    log('Iniciando scraping com BrowserWindow invisível...');
    
    win = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    // defaultSession compartilha os cookies do login (ADR-015/019)

    atualizarLogScraping(logId, { status: 'navegando_relatorio', mensagem: 'Acessando relatório de alunos...' });
    
    const reportUrl = `${BASE_URL}/ConexaoEducacao/Relatorio/PageViewer.aspx?report=RelAlunosMatPTurma&grp=GESTAO`;
    await win.loadURL(reportUrl);
    log(`Página do relatório carregada: ${reportUrl}`);
    
    await delay(5000); 

    let scrapingState = 'SETUP_FILTERS';
    
    let semestresToScrape = [];
    let currentSemestre = null;
    let turmasToScrape = [];
    let currentTurma = null;
    let allAlunos = [];
    
    let stateRetries = 0;
    let iframeRetries = 0;
    const MAX_IFRAME_RETRIES = 15;

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

      // Verifica cancelamento
      if (isCancelled()) {
        log('⛔ Cancelamento solicitado pelo usuário.');
        atualizarLogScraping(logId, { status: 'cancelado', mensagem: 'Sincronização cancelada pelo usuário.' });
        break;
      }
      
      // Sempre espera o ASP.NET terminar os processamentos assíncronos
      const ready = await waitAspNetReady(win);
      if (!ready) {
        log('TIMEOUT! ASP.NET preso em isInAsyncPostBack.');
        atualizarLogScraping(logId, { status: 'erro', mensagem: 'Servidor demorou muito a responder (Timeout ASP.NET).' });
        break;
      }

      // ==================================================
      // ESTADO: SETUP_FILTERS
      // ==================================================
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
          log(`Selecionando ${label}...`);
          log(`${label}: ${setupState.opt.text} ✔`);
          atualizarLogScraping(logId, { status: 'extraindo_dados', mensagem: `${label}: ${setupState.opt.text} selecionado(a).` });
          
          await win.webContents.executeJavaScript(`
            (() => {
              const el = document.getElementById('${setupState.id}');
              el.value = '${setupState.opt.val}';
              el.dispatchEvent(new Event('change', { bubbles: true }));
            })();
          `);
          await delay(1000);
        } else if (setupState.action === 'done') {
          log('Filtros base preenchidos. Indo capturar semestres...');
          atualizarLogScraping(logId, { status: 'extraindo_dados', mensagem: 'Filtros configurados. Mapeando semestres...' });
          scrapingState = 'FETCH_SEMESTRES';
        }
      } 
      
      // ==================================================
      // ESTADO: FETCH_SEMESTRES
      // ==================================================
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
        log(`Encontrados ${semestresToScrape.length} semestres válidos.`);
        atualizarLogScraping(logId, { status: 'extraindo_dados', mensagem: `${semestresToScrape.length} semestres encontrados.` });
        scrapingState = 'SELECT_SEMESTRE';
      }

      // ==================================================
      // ESTADO: SELECT_SEMESTRE
      // ==================================================
      else if (scrapingState === 'SELECT_SEMESTRE') {
        if (semestresToScrape.length === 0) {
          scrapingState = 'DONE';
          continue;
        }

        currentSemestre = semestresToScrape.shift();
        log(`═══════════════════════════════════════`);
        log(`Selecionando Semestre: ${currentSemestre.text}`);
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

      // ==================================================
      // ESTADO: FETCH_TURMAS
      // ==================================================
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
          log(`Semestre ${currentSemestre.text} não possui turmas. Pulando...`);
          atualizarLogScraping(logId, { status: 'extraindo_dados', mensagem: `Semestre ${currentSemestre.text} sem turmas, pulando.` });
          scrapingState = 'SELECT_SEMESTRE';
        } else {
          log(`Semestre ${currentSemestre.text} tem ${turmasToScrape.length} turmas mapeadas.`);
          atualizarLogScraping(logId, { status: 'extraindo_dados', mensagem: `Semestre ${currentSemestre.text}: ${turmasToScrape.length} turmas encontradas.` });
          scrapingState = 'SCRAPE_TURMA';
        }
      }

      // ==================================================
      // ESTADO: SCRAPE_TURMA
      // ==================================================
      else if (scrapingState === 'SCRAPE_TURMA') {
        if (turmasToScrape.length === 0) {
          log(`Turmas do semestre esgotadas. Voltando para semestres...`);
          scrapingState = 'SELECT_SEMESTRE';
          continue;
        }

        currentTurma = turmasToScrape.shift();
        iframeRetries = 0; // reset para a nova turma
        log(`>> Raspando Turma: ${currentTurma.text} (Faltam ${turmasToScrape.length} neste semestre)`);
        atualizarLogScraping(logId, { 
          status: 'extraindo_dados', 
          mensagem: `Extraindo turma: ${currentTurma.text} (restam ${turmasToScrape.length})` 
        });

        // Seleciona a turma e clica "View Report"
        await win.webContents.executeJavaScript(`
          (() => {
            document.getElementById('rptViewer_ctl00_ctl13_ddValue').value = '${currentTurma.val}';
            document.getElementById('rptViewer_ctl00_ctl00').click();
          })();
        `);
        
        // Iframe load é separado do PageRequestManager
        await delay(5000); 
        scrapingState = 'WAIT_IFRAME_REPORT';
      }

      // ==================================================
      // ESTADO: WAIT_IFRAME_REPORT
      // ==================================================
      else if (scrapingState === 'WAIT_IFRAME_REPORT') {

        // Proteção contra loop infinito
        if (iframeRetries >= MAX_IFRAME_RETRIES) {
          log(`⚠ Iframe não encontrado após ${MAX_IFRAME_RETRIES} tentativas para turma ${currentTurma.text}. Pulando...`);
          atualizarLogScraping(logId, { 
            status: 'extraindo_dados', 
            mensagem: `Turma ${currentTurma.text} pulada (iframe não carregou).` 
          });
          
          // Salva debug
          try {
            const pageHtml = await win.webContents.executeJavaScript(`document.body.innerHTML`);
            const debugPath = path.join(require('electron').app.getPath('userData'), 'data', 'debug_report_iframe.html');
            fs.writeFileSync(debugPath, pageHtml, 'utf-8');
            log(`HTML de debug salvo em: ${debugPath}`);
          } catch(e) { /* ignora */ }

          scrapingState = 'SCRAPE_TURMA'; // pula para a próxima turma
          continue;
        }

        const iframeState = await win.webContents.executeJavaScript(`
          (() => {
            try {
              // Descoberta automática: tenta vários IDs comuns do SSRS ReportViewer
              const possibleIds = [
                'rptViewer_ReportFrame',
                'ReportFramerptViewer',
                'rptViewer_ctl00_ReportFrame'
              ];
              
              let iframe = null;
              let foundId = '';
              
              // Tenta IDs conhecidos
              for (const id of possibleIds) {
                const el = document.getElementById(id);
                if (el) { iframe = el; foundId = id; break; }
              }
              
              // Fallback: busca qualquer iframe/frame que aponte para o SSRS
              if (!iframe) {
                const allIframes = document.querySelectorAll('iframe, frame');
                for (const f of allIframes) {
                  const src = f.src || f.getAttribute('src') || '';
                  if (src.includes('ReportViewer') || src.includes('Reserved') || src.includes('PageViewer')) {
                    iframe = f;
                    foundId = f.id || '(sem id)';
                    break;
                  }
                }
              }
              
              // Se ainda não achou, lista todos para debug
              if (!iframe) {
                const iframeInfo = Array.from(document.querySelectorAll('iframe, frame')).map(f => ({
                  tag: f.tagName, id: f.id, name: f.name, src: (f.src || '').substring(0, 100)
                }));
                return { error: 'iframe_not_found', debug: JSON.stringify(iframeInfo) };
              }
              
              let doc = null;
              try { doc = iframe.contentDocument; } catch(e) { return { error: 'iframe_cross_origin' }; }
              if (!doc || !doc.body) return { error: 'iframe_no_document' };
              
              // SSRS pode ter um sub-frame "report" dentro do frameset
              try {
                const subFrame = doc.getElementById('report');
                if (subFrame && subFrame.contentDocument) {
                  doc = subFrame.contentDocument;
                }
              } catch(e) { /* ignora se cross-origin */ }

              // Busca TRs cuja 1ª coluna seja matrícula (10+ dígitos)
              const trs = Array.from(doc.querySelectorAll('table tr')).filter(tr => {
                const tds = tr.querySelectorAll('td');
                if (tds.length < 4) return false;
                const txt = tds[0].innerText.trim();
                return /^\\d{10,}$/.test(txt);
              });
              
              if (trs.length === 0) {
                // Pode ser que o relatório ainda esteja carregando
                const bodyText = doc.body.innerText || '';
                if (bodyText.length < 50) {
                  return { error: 'iframe_loading', foundId: foundId };
                }
                return { error: 'table_not_found', html: doc.body.innerHTML.substring(0, 5000), foundId: foundId };
              }
              
              const alunos = [];
              trs.forEach(tr => {
                const tds = tr.querySelectorAll('td');
                const matricula = tds[0].innerText.trim();
                const nome = tds[1].innerText.trim();
                if (nome && matricula) {
                  alunos.push({ nome, matricula, turma_nome: '${currentTurma.text}' });
                }
              });
              return { error: null, alunos, foundId: foundId };
            } catch (e) {
              return { error: 'js_exception', message: e.message };
            }
          })();
        `);

        if (iframeState.error === 'table_not_found') {
          const debugPath = path.join(require('electron').app.getPath('userData'), 'data', 'debug_report_iframe.html');
          fs.writeFileSync(debugPath, iframeState.html || '', 'utf-8');
          log(`═══════════════════════════════════════`);
          log(`A tabela de alunos não foi encontrada na Turma ${currentTurma.text}!`);
          log(`Iframe encontrado: ${iframeState.foundId}`);
          log(`HTML de debug salvo em: ${debugPath}`);
          log(`Abra esse arquivo, inspecione a estrutura e me passe!`);
          log(`═══════════════════════════════════════`);
          
          atualizarLogScraping(logId, { status: 'erro', mensagem: `Tabela de alunos não encontrada. HTML salvo para debug.` });
          scrapingState = 'DONE';
          break;
        } else if (iframeState.error) {
          iframeRetries++;
          if (iframeRetries <= 3 || iframeRetries % 5 === 0) {
            log(`Aguardando iframe... (tentativa ${iframeRetries}/${MAX_IFRAME_RETRIES}) [${iframeState.error}]`);
            if (iframeState.debug) log(`Iframes encontrados na página: ${iframeState.debug}`);
          }
          atualizarLogScraping(logId, { 
            status: 'extraindo_dados', 
            mensagem: `Aguardando carregamento do relatório (${iframeRetries}/${MAX_IFRAME_RETRIES})...` 
          });
          await delay(3000);
          // Permanece no mesmo estado
        } else {
          log(`✔ Extraídos ${iframeState.alunos.length} alunos da turma ${currentTurma.text} (iframe: ${iframeState.foundId})`);
          atualizarLogScraping(logId, { 
            status: 'extraindo_dados', 
            mensagem: `Turma ${currentTurma.text}: ${iframeState.alunos.length} alunos extraídos ✔` 
          });
          allAlunos.push(...iframeState.alunos);
          iframeRetries = 0;
          
          // Volta pra próxima turma
          scrapingState = 'SCRAPE_TURMA';
        }
      }
    }

    // Salvar alunos caso tenhamos achado algum
    if (allAlunos.length > 0) {
      log(`Salvando ${allAlunos.length} alunos no banco de dados...`);
      atualizarLogScraping(logId, { status: 'extraindo_dados', mensagem: `Salvando ${allAlunos.length} alunos no banco...` });
      upsertAlunosBatch(allAlunos);
      log(`Salvamento concluído!`);
    }

    if (scrapingState === 'DONE') {
      log(`Processo finalizado! Total: ${allAlunos.length} alunos.`);
      atualizarLogScraping(logId, { 
        status: 'concluido', 
        total_alunos: allAlunos.length, 
        mensagem: `Sincronização concluída! ${allAlunos.length} alunos importados.` 
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
  iniciarScraping,
  requestCancel,
  isCancelled,
};
