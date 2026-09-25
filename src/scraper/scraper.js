// ============================================================
// Picasso — Scraper via Electron BrowserWindow
// ============================================================
const { BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { criarLogScraping, atualizarLogScraping, upsertAlunosBatch, getConfiguracoes } = require('../db/database');

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
 * Executa uma ação (clique ou evento) e aguarda reativamente o ASP.NET terminar o postback.
 * Resolve a Race Condition amarrando o listener ANTES de despachar a ação.
 */
async function waitAspNetReady(win, actionScript = '', readyCondition = null) {
  const cfg = getConfiguracoes();
  const raw = String(cfg.timeoutScraping || '').trim();
  const parsed = Number(raw);
  const timeoutMs = (raw !== '' && Number.isInteger(parsed) && parsed > 0) ? parsed * 1000 : 60000;

  try {
    await win.webContents.executeJavaScript(`
      new Promise((resolve, reject) => {
        const startTime = Date.now();
        console.log('[Scraper-DOM] Preparando ação atômica e aguardando postback...');

        let isDone = false;
        let endRequestHandler = null;
        let prm = null;
        let observer = null;

        const cleanup = () => {
          if (observer) observer.disconnect();
          if (prm && endRequestHandler) {
            try { prm.remove_endRequest(endRequestHandler); } catch(e) {}
          }
        };

        const timeoutTimer = setTimeout(() => {
          if (!isDone) {
            isDone = true;
            cleanup();
            console.error('[Scraper-DOM] Timeout de rede atingido após ' + (Date.now() - startTime) + 'ms');
            reject(new Error('Network Timeout'));
          }
        }, ${timeoutMs});

        const finish = () => {
          if (!isDone) {
            isDone = true;
            cleanup();
            clearTimeout(timeoutTimer);
            const duration = Date.now() - startTime;
            console.log('[Scraper-DOM] Operação assíncrona concluída em ' + duration + 'ms');
            resolve(true);
          }
        };

        // Verifica se o DOM já está limpo
        const checkReady = () => {
          try {
            if (typeof Sys !== 'undefined' && Sys.WebForms && Sys.WebForms.PageRequestManager) {
              if (Sys.WebForms.PageRequestManager.getInstance().get_isInAsyncPostBack()) return false;
            }
            const updateProgress = document.getElementById('UpdateProgress1') || document.querySelector('[id*="UpdateProgress"]');
            if (updateProgress && updateProgress.style.display !== 'none' && updateProgress.style.visibility !== 'hidden') return false;
            
            // Nova checagem customizada
            if (${readyCondition ? 'true' : 'false'}) {
               const conditionMet = new Function(${JSON.stringify(readyCondition || '')})();
               if (!conditionMet) return false;
            }
            return true;
          } catch(e) { return false; }
        };

        // Escuta eventos do ASP.NET
        if (typeof Sys !== 'undefined' && Sys.WebForms && Sys.WebForms.PageRequestManager) {
           prm = Sys.WebForms.PageRequestManager.getInstance();
           endRequestHandler = () => { finish(); };
           prm.add_endRequest(endRequestHandler);
        }

        // Escuta mutações no DOM (UpdateProgress)
        observer = new MutationObserver(() => {
           if (checkReady()) { finish(); }
        });
        observer.observe(document.body, { childList: true, subtree: true, attributes: true });

        // Executa a ação injetada
        try {
          ${actionScript || '/* Apenas aguarda carregamento inicial */'}
        } catch(e) {
          if (!isDone) {
            isDone = true;
            cleanup();
            clearTimeout(timeoutTimer);
            reject(new Error('Erro na ação injetada: ' + e.message));
          }
        }

        // Se a ação não disparou um postback (ou se foi apenas um wait), tenta verificar se já está pronto no próximo tick
        setTimeout(() => {
           if (!isDone && checkReady()) {
              finish();
           }
        }, 100);
      })
    `);
    return true;
  } catch (err) {
    throw err; // Propaga os timeouts corretamente ao invés de ignorar!
  }
}

let isScrapingRunning = false;
function getIsScrapingRunning() { return isScrapingRunning; }

async function iniciarScraping(cookies) {
  if (isScrapingRunning) return;
  isScrapingRunning = true;
  cancelRequested = false;
  let logId = null;
  let win = null;

  try {
    logId = criarLogScraping();
    log('Iniciando scraping com BrowserWindow invisível...');
    
    win = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    win.webContents.on('console-message', (event, levelOrDetails, messageText) => {
      const msg = typeof levelOrDetails === 'object' && levelOrDetails.message 
        ? levelOrDetails.message 
        : (messageText || '');
      if (typeof msg === 'string' && msg.startsWith('[Scraper-DOM]')) {
        log(msg);
      }
    });

    // defaultSession compartilha os cookies do login (ADR-015/019)

    atualizarLogScraping(logId, { status: 'navegando_relatorio', mensagem: 'Acessando relatório de alunos...' });
    
    const reportUrl = `${BASE_URL}/ConexaoEducacao/Relatorio/PageViewer.aspx?report=RelAlunosMatPTurma&grp=GESTAO`;
    await win.loadURL(reportUrl);
    log(`Página do relatório carregada: ${reportUrl}`);
    
    // Aguarda o carregamento inicial de forma reativa e espera as opções do Regional
    const initialReady = await waitAspNetReady(win, '', "return document.getElementById('rptViewer_ctl00_ctl03_ddValue') !== null && document.getElementById('rptViewer_ctl00_ctl03_ddValue').options.length > 0");
    if (!initialReady) throw new Error('Timeout carregando página inicial.');

    let scrapingState = 'SETUP_FILTERS';
    
    let semestresToScrape = [];
    let currentSemestre = null;
    let turmasToScrape = [];
    let currentTurma = null;
    let allAlunos = [];
    
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
            throw new Error(`Não foi possível achar opção válida para o filtro ${setupState.id} (DOM pronto, mas filtro vazio).`);
          }
          
          const label = FIELD_NAMES[setupState.id] || setupState.id;
          log(`Selecionando ${label}...`);
          log(`${label}: ${setupState.opt.text} ✔`);
          atualizarLogScraping(logId, { status: 'extraindo_dados', mensagem: `${label}: ${setupState.opt.text} selecionado(a).` });
          
          await waitAspNetReady(win, `
            const el = document.getElementById('${setupState.id}');
            el.value = '${setupState.opt.val}';
            el.dispatchEvent(new Event('change', { bubbles: true }));
          `);
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

        await waitAspNetReady(win, `
          const el = document.getElementById('rptViewer_ctl00_ctl11_ddValue');
          el.value = '${currentSemestre.val}';
          el.dispatchEvent(new Event('change', { bubbles: true }));
        `);
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
        await waitAspNetReady(win, `
          document.getElementById('rptViewer_ctl00_ctl13_ddValue').value = '${currentTurma.val}';
          document.getElementById('rptViewer_ctl00_ctl00').click();
        `);
        
        scrapingState = 'WAIT_IFRAME_REPORT';
      }

      else if (scrapingState === 'WAIT_IFRAME_REPORT') {
        atualizarLogScraping(logId, { status: 'extraindo_dados', mensagem: `Aguardando carregamento do relatório para turma ${currentTurma.text}...` });
        
        const iframeState = await win.webContents.executeJavaScript(`
          new Promise((resolve) => {
            const startTime = Date.now();
            const tMs = ${timeoutMs};
            
            let isDone = false;
            let mainObserver = null;
            let iframeObserver = null;
            let timeoutTimer = null;
            let loadHandler = null;

            const cleanup = () => {
               if (mainObserver) mainObserver.disconnect();
               if (iframeObserver) iframeObserver.disconnect();
               if (timeoutTimer) clearTimeout(timeoutTimer);
               if (loadHandler) {
                 document.body.removeEventListener('load', loadHandler, true);
               }
            };

            const finish = (result) => {
               if (!isDone) {
                  isDone = true;
                  cleanup();
                  resolve(result);
               }
            };

            timeoutTimer = setTimeout(() => {
               finish({ error: 'iframe_not_found_timeout' });
            }, tMs);

            const tryExtract = () => {
              try {
                const possibleIds = [
                  'rptViewer_ReportFrame',
                  'ReportFramerptViewer',
                  'rptViewer_ctl00_ReportFrame'
                ];
                
                let iframe = null;
                let foundId = '';
                
                for (const id of possibleIds) {
                  const el = document.getElementById(id);
                  if (el) { iframe = el; foundId = id; break; }
                }
                
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
                
                if (!iframe) return; 
                
                let doc = null;
                try { doc = iframe.contentDocument; } catch(e) { }
                if (!doc || !doc.body) return; 

                if (doc.body.getAttribute('data-scraped-turma') === '${currentTurma.val}') return;

                if (!iframeObserver || iframeObserver.doc !== doc) {
                   if (iframeObserver) iframeObserver.disconnect();
                   iframeObserver = new MutationObserver(tryExtract);
                   iframeObserver.doc = doc;
                   iframeObserver.observe(doc.body, { childList: true, subtree: true, attributes: true });
                }
                
                try {
                  const subFrame = doc.getElementById('report');
                  if (subFrame && subFrame.contentDocument) doc = subFrame.contentDocument;
                } catch(e) { }

                const trs = Array.from(doc.querySelectorAll('table tr')).filter(tr => {
                  const tds = tr.querySelectorAll('td');
                  if (tds.length < 4) return false;
                  return /^\\d{10,}$/.test(tds[0].innerText.trim());
                });
                
                if (trs.length === 0) return; 
                
                doc.body.setAttribute('data-scraped-turma', '${currentTurma.val}');
                
                const alunos = [];
                trs.forEach(tr => {
                  const tds = tr.querySelectorAll('td');
                  const matricula = tds[0].innerText.trim();
                  const nome = tds[1].innerText.trim();
                  if (nome && matricula) {
                    alunos.push({ nome, matricula, turma_nome: '${currentTurma.text}' });
                  }
                });
                
                finish({ error: null, alunos, foundId: foundId });
              } catch (e) {
                 // Ignore errors during check, as DOM might be in flux
              }
            };

            mainObserver = new MutationObserver(tryExtract);
            mainObserver.observe(document.body, { childList: true, subtree: true, attributes: true });

            loadHandler = (e) => {
               if (e.target && (e.target.tagName === 'IFRAME' || e.target.tagName === 'FRAME')) {
                  tryExtract();
               }
            };
            document.body.addEventListener('load', loadHandler, true);

            tryExtract();
          })
        `);

        if (iframeState.error === 'table_not_found') {
          const debugPath = path.join(require('electron').app.getPath('userData'), 'data', 'debug_report_iframe.html');
          fs.writeFileSync(debugPath, iframeState.html || '', 'utf-8');
          log(`═══════════════════════════════════════`);
          log(`A tabela de alunos não foi encontrada na Turma ${currentTurma.text}! Pulando para a próxima...`);
          log(`Iframe encontrado: ${iframeState.foundId}`);
          log(`═══════════════════════════════════════`);
          
          atualizarLogScraping(logId, { status: 'extraindo_dados', mensagem: `Turma ${currentTurma.text} sem tabela de alunos. Pulando.` });
          scrapingState = 'SCRAPE_TURMA';
          continue;
        } else if (iframeState.error) {
          throw new Error(`Falha na extração do iframe para turma ${currentTurma.text}: ${iframeState.error}`);
        } else {
          log(`✔ Extraídos ${iframeState.alunos.length} alunos da turma ${currentTurma.text} (iframe: ${iframeState.foundId})`);
          atualizarLogScraping(logId, { 
            status: 'extraindo_dados', 
            mensagem: `Turma ${currentTurma.text}: ${iframeState.alunos.length} alunos extraídos ✔` 
          });
          allAlunos.push(...iframeState.alunos);
          
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
    if (logId) {
      atualizarLogScraping(logId, { 
        status: 'erro', 
        mensagem: error.message 
      });
    }
  } finally {
    isScrapingRunning = false;
    if (win) {
      win.close();
    }
  }
}

module.exports = {
  iniciarScraping,
  requestCancel,
  isCancelled,
  getIsScrapingRunning,
};
