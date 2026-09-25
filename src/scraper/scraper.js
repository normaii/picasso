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
    const waitPromise = win.webContents.executeJavaScript(`
      new Promise((resolve, reject) => {
        const startTime = Date.now();
        console.log('[Scraper-DOM] Preparando ação atômica e aguardando postback...');

        let isDone = false;
        let endRequestHandler = null;
        let beginRequestHandler = null;
        let prm = null;
        let observer = null;

        const cleanup = () => {
          if (observer) observer.disconnect();
          if (prm) {
            if (beginRequestHandler) {
              try { prm.remove_beginRequest(beginRequestHandler); } catch(e) {}
            }
            if (endRequestHandler) {
              try { prm.remove_endRequest(endRequestHandler); } catch(e) {}
            }
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

        const finish = (msg) => {
          if (!isDone) {
            isDone = true;
            cleanup();
            clearTimeout(timeoutTimer);
            const duration = Date.now() - startTime;
            console.log('[Scraper-DOM] Operação assíncrona concluída [' + (msg || 'Ready') + '] em ' + duration + 'ms');
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
               return 'Custom ReadyCondition Met';
            }
            return 'Default ASP.NET Ready';
          } catch(e) { return false; }
        };

        const hasAction = ${actionScript ? 'true' : 'false'};
        let sawBeginRequest = false;
        let hasPRM = false;

        // Escuta eventos do ASP.NET
        if (typeof Sys !== 'undefined' && Sys.WebForms && Sys.WebForms.PageRequestManager) {
           hasPRM = true;
           prm = Sys.WebForms.PageRequestManager.getInstance();
           // Observa o início do postback para saber que a ação realmente disparou
           beginRequestHandler = () => { sawBeginRequest = true; };
           prm.add_beginRequest(beginRequestHandler);
           endRequestHandler = () => { 
              if (hasAction && hasPRM && !sawBeginRequest) return;
              const msg = checkReady();
              if (msg) finish(msg); 
           };
           prm.add_endRequest(endRequestHandler);
        }

        // Escuta mutações no DOM (UpdateProgress)
        observer = new MutationObserver(() => {
           // Se há ação E temos PRM, só pode resolver após observar o beginRequest
           if (hasAction && hasPRM && !sawBeginRequest) return;
           const msg = checkReady();
           if (msg) { finish(msg); }
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

        // Fallback: se NÃO há ação, verifica readiness imediatamente no próximo tick
        if (!hasAction) {
          setTimeout(() => {
             if (!isDone) {
                const msg = checkReady();
                if (msg) { finish(msg); }
             }
          }, 100);
        }
        // Se há ação que cause postback parcial, os listeners do PageRequestManager cuidam.
        // Se a ação causar full postback, o contexto será destruído e trataremos no Node.js.
      })
    `);

    let isRaceDone = false;
    const cancelPoll = async () => {
      while (!isCancelled() && !isRaceDone) { await delay(500); }
      return { cancelled: true };
    };

    let result;
    try {
      try {
        result = await Promise.race([ waitPromise, cancelPoll() ]);
      } catch (err) {
        if (err.message && (err.message.includes('Execution context was destroyed') || err.message.includes('Inspected target navigated') || err.message.includes('Script failed to execute') || err.message.includes('this world has been destroyed'))) {
           log('Full postback detectado (contexto destruído). Aguardando did-finish-load do BrowserWindow...');
           
           let timeoutTimer;
           let onFinishLoad;
           
           const doCheckReady = async () => {
              if (readyCondition) {
                 return await win.webContents.executeJavaScript(`
                     new Promise((res, rej) => {
                        let observer;
                        const cleanup = () => {
                           if (observer) observer.disconnect();
                           clearTimeout(failTimer);
                        };
                        const check = () => {
                           try {
                              const met = new Function(${JSON.stringify(readyCondition)})();
                              if (met) { cleanup(); res(true); }
                           } catch(e) {}
                        };
                        observer = new MutationObserver(check);
                        observer.observe(document.body, { childList: true, subtree: true, attributes: true });
                        const failTimer = setTimeout(() => { cleanup(); rej(new Error('Network Timeout (Ready Condition)')); }, ${timeoutMs});
                        check();
                     })
                 `);
              }
              return true;
           };

           const fallbackPromise = new Promise((resolve, reject) => {
              timeoutTimer = setTimeout(() => reject(new Error('Network Timeout (Full Postback)')), timeoutMs);
              onFinishLoad = async () => {
                 try {
                    await doCheckReady();
                    log('[Scraper-DOM] Operação assíncrona concluída [' + (readyCondition ? 'Custom ReadyCondition Met' : 'Default ASP.NET Ready') + '] após Full Postback');
                    resolve(true);
                 } catch (e) { reject(e); }
              };
              
              if (!win.webContents.isLoading()) {
                 onFinishLoad();
              } else {
                 win.webContents.once('did-finish-load', onFinishLoad);
              }
           });
           
           try {
              result = await Promise.race([ fallbackPromise, cancelPoll() ]);
           } finally {
              clearTimeout(timeoutTimer);
              if (onFinishLoad) win.webContents.removeListener('did-finish-load', onFinishLoad);
           }
        } else {
           throw err; // Propaga os timeouts corretamente ao invés de ignorar!
        }
      }
    } finally {
      isRaceDone = true;
    }
    
    if (result && result.cancelled) {
      throw new Error('Sincronização cancelada pelo usuário.');
    }
    
    return true;
  } catch (err) {
    throw err;
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

  const cfg = getConfiguracoes();
  const raw = String(cfg.timeoutScraping || '').trim();
  const parsed = Number(raw);
  const timeoutMs = (raw !== '' && Number.isInteger(parsed) && parsed > 0) ? parsed * 1000 : 60000;

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
    
    const initialTimeoutMs = timeoutMs;

    let isLoadRaceDone = false;
    const cancelLoadPoll = async () => {
      while (!isCancelled() && !isLoadRaceDone) { await delay(500); }
      return { error: 'cancelled' };
    };

    let loadTimerId;
    const loadTimeoutPromise = new Promise(resolve => {
       loadTimerId = setTimeout(() => resolve({ error: 'timeout' }), initialTimeoutMs);
    });

    let loadState;
    try {
      loadState = await Promise.race([ 
        win.loadURL(reportUrl).then(() => ({ success: true })).catch(e => ({ error: e.message })), 
        cancelLoadPoll(),
        loadTimeoutPromise
      ]);
    } finally {
      isLoadRaceDone = true;
      clearTimeout(loadTimerId);
    }

    if (loadState.error === 'cancelled') {
      throw new Error('Sincronização cancelada pelo usuário.');
    } else if (loadState.error === 'timeout') {
      throw new Error('Timeout carregando página inicial do relatório.');
    } else if (loadState.error) {
      throw new Error(`Erro ao carregar página: ${loadState.error}`);
    }

    log(`Página do relatório carregada: ${reportUrl}`);
    // Aguarda o carregamento inicial de forma reativa e espera as opções do Regional
    const initialReady = await waitAspNetReady(win, '', "return (() => { const el = document.getElementById('rptViewer_ctl00_ctl03_ddValue'); return el && Array.from(el.options).some(o => o.value !== '0' && !o.text.toUpperCase().includes('SELECT') && !o.text.toUpperCase().includes('SELECIONE')); })()");
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
              if (!isValidOpt(regCurrent)) return { action: 'select', id: regId, opt: pickFirst(regOpts), nextId: munId };
              
              const munCurrent = munOpts.find(o => o.val === getVal(munId));
              if (!isValidOpt(munCurrent)) return { action: 'select', id: munId, opt: pickFirst(munOpts), nextId: escId };
              
              const escCurrent = escOpts.find(o => o.val === getVal(escId));
              if (!isValidOpt(escCurrent)) return { action: 'select', id: escId, opt: pickFirst(escOpts), nextId: anoId };
              
              const anoCurrent = anoOpts.find(o => o.val === getVal(anoId));
              if (!isValidOpt(anoCurrent)) return { action: 'select', id: anoId, opt: pickFirst(anoOpts), nextId: 'rptViewer_ctl00_ctl11_ddValue' };
              
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
            // Dropdown dependente pode estar vazio porque o anterior ainda não populou — aguarda ao invés de abortar
            log(`Dropdown ${setupState.id} vazio, aguardando repopulação via postback...`);
            await waitAspNetReady(win, '', `return (() => { const el = document.getElementById('${setupState.id}'); if (!el) return false; const opts = Array.from(el.options); return opts.some(o => o.value !== '0' && !o.text.toUpperCase().includes('SELECT') && !o.text.toUpperCase().includes('SELECIONE')); })()`);
            continue; // Re-avalia o SETUP_FILTERS com o dropdown agora populado
          }
          
          const label = FIELD_NAMES[setupState.id] || setupState.id;
          log(`Selecionando ${label}...`);
          log(`${label}: ${setupState.opt.text} ✔`);
          atualizarLogScraping(logId, { status: 'extraindo_dados', mensagem: `${label}: ${setupState.opt.text} selecionado(a).` });
          
          // Seleciona e dispara o change, depois aguarda que o PRÓXIMO dropdown dependente seja populado
          const nextDropdownId = setupState.nextId || null;
          const readyCond = nextDropdownId
            ? `return (() => { const el = document.getElementById('${nextDropdownId}'); if (!el) return true; const opts = Array.from(el.options); return opts.some(o => o.value !== '0' && !o.text.toUpperCase().includes('SELECT') && !o.text.toUpperCase().includes('SELECIONE')); })()`
            : null;
          
          await waitAspNetReady(win, `
            const nextEl = document.getElementById('${nextDropdownId}');
            if (nextEl) { nextEl.innerHTML = ''; }
            const el = document.getElementById('${setupState.id}');
            el.value = ${JSON.stringify(setupState.opt.val)};
            el.dispatchEvent(new Event('change', { bubbles: true }));
          `, readyCond);
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
          const nextEl = document.getElementById('rptViewer_ctl00_ctl13_ddValue');
          if (nextEl) { nextEl.innerHTML = ''; }
          const el = document.getElementById('rptViewer_ctl00_ctl11_ddValue');
          el.value = ${JSON.stringify(currentSemestre.val)};
          el.dispatchEvent(new Event('change', { bubbles: true }));
        `, `return (() => { const el = document.getElementById('rptViewer_ctl00_ctl13_ddValue'); if (!el) return true; const opts = Array.from(el.options); return opts.some(o => o.value !== '0' && !o.text.toUpperCase().includes('SELECT') && !o.text.toUpperCase().includes('SELECIONE')); })()`);
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

        // Invalida o relatório antigo (se houver) e clica "View Report" sem usar waitAspNetReady.
        // Ações de iframe não emitem beginRequest no PRM pai, então roteamos diretamente para WAIT_IFRAME_REPORT.
        await win.webContents.executeJavaScript(`
          try {
             const markOld = (d) => {
                 d.querySelectorAll('table').forEach(t => t.setAttribute('data-old-report', 'true'));
             };
             document.querySelectorAll('iframe, frame').forEach(f => {
                if (f.contentDocument) {
                    markOld(f.contentDocument);
                    f.contentDocument.querySelectorAll('iframe, frame').forEach(subF => {
                       if (subF.contentDocument) markOld(subF.contentDocument);
                    });
                }
             });
          } catch(e) {}

          document.getElementById('rptViewer_ctl00_ctl13_ddValue').value = ${JSON.stringify(currentTurma.val)};
          document.getElementById('rptViewer_ctl00_ctl00').click();
        `);
        
        scrapingState = 'WAIT_IFRAME_REPORT';
      }

      else if (scrapingState === 'WAIT_IFRAME_REPORT') {
        atualizarLogScraping(logId, { status: 'extraindo_dados', mensagem: `Aguardando carregamento do relatório para turma ${currentTurma.text}...` });
        
        const iframePromise = win.webContents.executeJavaScript(`
          new Promise((resolve) => {
            const startTime = Date.now();
            const tMs = ${timeoutMs};
            
            let isDone = false;
            let reportSuccessfullyLoaded = false;
            let lastReportDoc = null;
            let extractDebounceTimer = null;
            let mainObserver = null;
            let iframeObserver = null;
            let timeoutTimer = null;
            let loadHandler = null;
            let subFrameRef = null;
            let subFrameLoadHandler = null;
            let lastFoundId = null;

            const cleanup = () => {
               if (mainObserver) mainObserver.disconnect();
               if (iframeObserver) iframeObserver.disconnect();
               if (timeoutTimer) clearTimeout(timeoutTimer);
               if (window._emptyTimer) {
                  clearTimeout(window._emptyTimer);
                  window._emptyTimer = null;
               }
               if (extractDebounceTimer) {
                  clearTimeout(extractDebounceTimer);
                  extractDebounceTimer = null;
               }
               if (loadHandler) {
                 document.body.removeEventListener('load', loadHandler, true);
               }
               if (subFrameRef && subFrameLoadHandler) {
                 subFrameRef.removeEventListener('load', subFrameLoadHandler);
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
               let fallbackHtml = '';
               try { if (lastReportDoc) fallbackHtml = lastReportDoc.documentElement.outerHTML; } catch(e) {}
               if (reportSuccessfullyLoaded) {
                  finish({ error: 'table_not_found', html: fallbackHtml || document.documentElement.outerHTML, foundId: lastFoundId });
               } else {
                  finish({ error: 'iframe_not_found_timeout', html: fallbackHtml || document.documentElement.outerHTML, foundId: lastFoundId });
               }
            }, tMs);

            const isVisible = (el) => {
              if (!el) return false;
              const style = el.ownerDocument && el.ownerDocument.defaultView
                ? el.ownerDocument.defaultView.getComputedStyle(el)
                : null;
              if (!style) return true;
              return style.display !== 'none' && style.visibility !== 'hidden';
            };

            const getViewerLoadingState = () => {
              try {
                if (typeof $find !== 'function') return null;
                const viewer = $find('rptViewer');
                if (!viewer || typeof viewer.get_isLoading !== 'function') return null;
                return viewer.get_isLoading();
              } catch (e) {
                return null;
              }
            };

            const tryExtractDebounced = () => {
               if (extractDebounceTimer) clearTimeout(extractDebounceTimer);
               extractDebounceTimer = setTimeout(tryExtract, 100);
            };

            const tryExtract = () => {
              if (isDone) return;
              
              if (window._emptyTimer) {
                 clearTimeout(window._emptyTimer);
                 window._emptyTimer = null;
              }
              
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
                
                if (foundId) lastFoundId = foundId;
                
                if (!iframe) return; 
                
                let doc = null;
                try { doc = iframe.contentDocument; } catch(e) { }
                if (!doc || !doc.body) return; 
                const reportRootDoc = doc;

                // SSRS pode ter um sub-frame "report" dentro do frameset principal
                try {
                  const subFrame = doc.getElementById('report');
                  if (subFrame) {
                     if (subFrameRef !== subFrame) {
                        if (subFrameRef && subFrameLoadHandler) {
                           subFrameRef.removeEventListener('load', subFrameLoadHandler);
                        }
                        subFrameRef = subFrame;
                        subFrameLoadHandler = tryExtract;
                        subFrame.addEventListener('load', subFrameLoadHandler);
                     }
                     // Se existe o frame aninhado mas ele ainda não tem documento, aguarda!
                     if (!subFrame.contentDocument || !subFrame.contentDocument.body) return;
                     doc = subFrame.contentDocument;
                  }
                } catch(e) { }

                // Agora doc aponta para o documento final (nested ou outer)
                lastReportDoc = doc;
                
                // Checa a marcação: se já foi scraped para ESTE semestre+turma, ignora
                const markerKey = ${JSON.stringify((currentSemestre ? currentSemestre.val + ':' : '') + currentTurma.val)};
                const scrapedVal = doc.body.getAttribute('data-scraped-turma');
                if (scrapedVal === markerKey) return;

                if (!iframeObserver || iframeObserver.doc !== doc) {
                   if (iframeObserver) iframeObserver.disconnect();
                   iframeObserver = new MutationObserver(tryExtractDebounced);
                   iframeObserver.doc = doc;
                   iframeObserver.observe(doc.body, { childList: true, subtree: true, attributes: true });
                }

                // Verifica indicadores de carregamento SSRS antes de processar qualquer coisa
                if (doc.readyState !== 'complete') return;

                const viewerLoadingState = getViewerLoadingState();
                if (viewerLoadingState === true) return;
                
                // Sinal explícito do SSRS de carregamento: AsyncWait
                const waitPanel = doc.getElementById('AsyncWait_Wait') || doc.querySelector('[id$="_AsyncWait_Wait"], div[id*="AsyncWait"]');
                if (isVisible(waitPanel)) return;

                const outerWaitPanel = reportRootDoc.getElementById('AsyncWait_Wait') || reportRootDoc.querySelector('[id$="_AsyncWait_Wait"], div[id*="AsyncWait"]');
                if (isVisible(outerWaitPanel)) return;

                // Apenas processa se houver uma nova tabela que o AJAX acabou de criar (ou se for um doc novo inteiro)
                const allTables = Array.from(doc.querySelectorAll('table'));
                if (allTables.length === 0) return; // Nenhuma tabela ainda (SSRS sempre gera tabelas, se está vazio, está carregando)
                
                const newTables = allTables.filter(t => !t.hasAttribute('data-old-report'));
                if (newTables.length === 0) return; // O UpdatePanel ainda não substituiu o DOM antigo!

                // Se passou por todas as gates de carregamento, o relatório carregou!
                reportSuccessfullyLoaded = true;

                const rawTrs = newTables.flatMap(t => Array.from(t.querySelectorAll('tr')));
                const uniqueTrs = Array.from(new Set(rawTrs));
                const trs = uniqueTrs.filter(tr => {
                  const tds = tr.querySelectorAll('td');
                  if (tds.length < 4) return false;
                  return /^\\d{10,}$/.test(tds[0].innerText.trim());
                });
                
                if (trs.length === 0) {
                   window._emptyTimer = setTimeout(() => {
                      window._emptyTimer = null;
                      let fallbackHtml = '';
                      try { if (lastReportDoc) fallbackHtml = lastReportDoc.documentElement.outerHTML; } catch(e) {}
                      finish({ error: 'table_not_found', html: fallbackHtml || document.documentElement.outerHTML, foundId });
                   }, 2000); // 2 segundos curtos de tolerância, reiniciados a cada mutação
                   return; 
                }
                
                const markerKey2 = ${JSON.stringify((currentSemestre ? currentSemestre.val + ':' : '') + currentTurma.val)};
                doc.body.setAttribute('data-scraped-turma', markerKey2);
                
                const alunos = [];
                trs.forEach(tr => {
                  const tds = tr.querySelectorAll('td');
                  const matricula = tds[0].innerText.trim();
                  const nome = tds[1].innerText.trim();
                  if (nome && matricula) {
                    alunos.push({ nome, matricula, turma_nome: ${JSON.stringify(currentTurma.text)} });
                  }
                });
                
                finish({ error: null, alunos, foundId: foundId });
              } catch (e) {
                 // Ignore errors during check, as DOM might be in flux
              }
            };

            mainObserver = new MutationObserver(tryExtractDebounced);
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

        let isRaceDone = false;
        const cancelPoll = async () => {
          while (!isCancelled() && !isRaceDone) { await delay(500); }
          return { error: 'cancelled' };
        };

        let iframeState;
        try {
           iframeState = await Promise.race([ iframePromise, cancelPoll() ]);
        } finally {
           isRaceDone = true;
        }

        if (iframeState.error === 'table_not_found') {
          const debugPath = path.join(require('electron').app.getPath('userData'), 'data', 'debug_report_iframe.html');
          fs.writeFileSync(debugPath, iframeState.html || '', 'utf-8');
          log(`═══════════════════════════════════════`);
          log(`A tabela de alunos não foi encontrada na Turma ${currentTurma.text}! Pulando para a próxima...`);
          log(`Iframe encontrado: ${iframeState.foundId || '(nenhum)'}`);
          log(`═══════════════════════════════════════`);
          
          atualizarLogScraping(logId, { status: 'extraindo_dados', mensagem: `Turma ${currentTurma.text} sem tabela de alunos. Pulando.` });
          scrapingState = 'SCRAPE_TURMA';
          continue;
        } else if (iframeState.error === 'iframe_not_found_timeout') {
          const debugPath = path.join(require('electron').app.getPath('userData'), 'data', 'debug_report_iframe.html');
          fs.writeFileSync(debugPath, iframeState.html || '', 'utf-8');
          throw new Error(`Falha na extração do iframe para turma ${currentTurma.text}: ${iframeState.error} (Network Timeout)`);
        } else if (iframeState.error === 'cancelled') {
          throw new Error('Sincronização cancelada pelo usuário.');
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
    if (error.message === 'Sincronização cancelada pelo usuário.') {
      log('⛔ Cancelamento solicitado pelo usuário durante espera ativa.');
      if (logId) atualizarLogScraping(logId, { status: 'cancelado', mensagem: error.message });
    } else {
      console.error('[Scraper] Erro catastrófico durante o scraping:', error);
      if (logId) {
        atualizarLogScraping(logId, { 
          status: 'erro', 
          mensagem: error.message 
        });
      }
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
