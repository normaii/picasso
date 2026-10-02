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

  if (actionScript) {
    await win.webContents.executeJavaScript(`
      try {
        ${actionScript}
      } catch(e) {
        console.error('[Scraper-DOM] Erro no actionScript:', e);
      }
    `);
  }

  const checkState = async () => {
    return await win.webContents.executeJavaScript(`
      (() => {
        try {
          if (typeof Sys !== 'undefined' && Sys.WebForms && Sys.WebForms.PageRequestManager) {
            if (Sys.WebForms.PageRequestManager.getInstance().get_isInAsyncPostBack()) return false;
          }
          const updateProgress = document.getElementById('UpdateProgress1') || document.querySelector('[id*="UpdateProgress"]');
          if (updateProgress && updateProgress.style.display !== 'none' && updateProgress.style.visibility !== 'hidden') return false;

          if (${readyCondition ? 'true' : 'false'}) {
            const conditionMet = new Function(${JSON.stringify(readyCondition || '')})();
            if (!conditionMet) return false;
          }
          return true;
        } catch(e) { return false; }
      })()
    `);
  };

  let timerId = null;
  const timeoutPromise = new Promise(resolve => {
    timerId = setTimeout(() => {
      resolve({ error: 'timeout' });
    }, timeoutMs);
  });

  const pollPromise = (async () => {
    let isRaceDone = false;
    while (!isCancelled() && !isRaceDone) {
      if (win.isDestroyed()) return { error: 'destroyed' };
      if (await checkState()) {
        isRaceDone = true;
        clearTimeout(timerId);
        return { success: true };
      }
      await delay(1000);
    }
    return { error: 'cancelled' };
  })();

  const result = await Promise.race([pollPromise, timeoutPromise]);
  if (result.error) {
    if (result.error === 'timeout') throw new Error('Timeout de rede atingido (waitAspNetReady).');
    if (result.error === 'destroyed') throw new Error('WebContents destruído durante a espera.');
    if (result.error === 'cancelled') throw new Error('Sincronização cancelada pelo usuário.');
  }
  return true;
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
      show: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: false
      }
    });
    win.webContents.openDevTools();

    // ==================================================
    // PATCH SSRS INFINITE LOOP
    // ==================================================
    // SSRS injects an iframe with `onload="if (location != 'javascript:\'\'') location.replace('javascript:\'\'');"`.
    // Modern Chromium normalizes `javascript:''` to `about:blank`, making the condition always TRUE.
    // This causes an infinite reload loop, which triggers Chromium's IPC Flooding Protection and freezes the page.
    // We inject a MutationObserver globally to nuke this `onload` attribute instantly.
    win.webContents.on('did-finish-load', () => {
      win.webContents.executeJavaScript(`
        if (!window._ssrsPatchApplied) {
           window._ssrsPatchApplied = true;
           
           // Nuke iframes already in the DOM
           const nukeBuggyIframes = () => {
             document.querySelectorAll('iframe[id*="rptViewerTouchSession"]').forEach(f => {
                if (f.hasAttribute('onload')) {
                   f.removeAttribute('onload');
                   console.log('[Scraper-DOM] Nucked buggy onload from SSRS session iframe');
                }
             });
           };
           nukeBuggyIframes();
           
           // Monkey-patch XHR to strip the buggy onload from ASP.NET UpdatePanel responses BEFORE they hit the DOM!
           const origXhrOpen = XMLHttpRequest.prototype.open;
           XMLHttpRequest.prototype.open = function() {
              this.addEventListener('readystatechange', function() {
                 if (this.readyState === 4 && this.responseText) {
                    try {
                       // O SSRS manda o iframe dentro da string do UpdatePanel.
                       // Vamos interceptar o responseText usando Object.defineProperty no objeto XHR atual.
                       const originalText = this.responseText;
                       if (originalText.includes('rptViewerTouchSession')) {
                          const safeText = originalText.replace(/onload="if \\(frames\\['rptViewerTouchSession\\d+'\\]\\.location[^>]+"/g, '');
                          if (safeText !== originalText) {
                             Object.defineProperty(this, 'responseText', { value: safeText });
                             console.log('[Scraper-DOM] XHR Patch: Buggy SSRS onload stripped from AJAX response!');
                          }
                       }
                    } catch(e) {}
                 }
              });
              origXhrOpen.apply(this, arguments);
           };
           
           new MutationObserver(nukeBuggyIframes).observe(document.documentElement, { childList: true, subtree: true });
        }
      `).catch(() => {});
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
      while (!isCancelled() && !isLoadRaceDone) { await delay(1000); }
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
              
              const stateLog = {
                regOpts: regOpts.length, regVal: getVal(regId),
                munOpts: munOpts.length, munVal: getVal(munId),
                escOpts: escOpts.length, escVal: getVal(escId)
              };
              console.log('[Scraper-DOM] Avaliando estado:', JSON.stringify(stateLog));

              const regCurrent = regOpts.find(o => o.val === getVal(regId));
              if (!isValidOpt(regCurrent)) return { action: 'select', id: regId, opt: pickFirst(regOpts), nextId: munId, debug: stateLog };
              
              const munCurrent = munOpts.find(o => o.val === getVal(munId));
              if (!isValidOpt(munCurrent)) return { action: 'select', id: munId, opt: pickFirst(munOpts), nextId: escId, debug: stateLog };
              
              const escCurrent = escOpts.find(o => o.val === getVal(escId));
              if (!isValidOpt(escCurrent)) return { action: 'select', id: escId, opt: pickFirst(escOpts), nextId: anoId, debug: stateLog };
              
              const anoCurrent = anoOpts.find(o => o.val === getVal(anoId));
              if (!isValidOpt(anoCurrent)) return { action: 'select', id: anoId, opt: pickFirst(anoOpts), nextId: 'rptViewer_ctl00_ctl11_ddValue', debug: stateLog };
              
              return { action: 'done', debug: stateLog };
            } catch (e) {
              return { error: e.message };
            }
          })();
        `);

        if (setupState.error) {
          throw new Error('Erro injetando scripts de setup: ' + setupState.error);
        }
        
        log(`[Debug] SetupState resolveu: ${JSON.stringify(setupState)}`);
        try {
          const debugLogPath = path.join(require('electron').app.getPath('userData'), 'data', 'debug_scraper_loop.txt');
          fs.appendFileSync(debugLogPath, `[${new Date().toISOString()}] SetupState resolveu: ${JSON.stringify(setupState)}\n`, 'utf-8');
        } catch(e) {}

        if (setupState.action === 'select') {
          if (!setupState.opt) {
            log(`Dropdown ${setupState.id} vazio, aguardando repopulação via postback...`);
            await waitAspNetReady(win, '', `return (() => { const el = document.getElementById('${setupState.id}'); if (!el) return false; const opts = Array.from(el.options); return opts.some(o => o.value !== '0' && !o.text.toUpperCase().includes('SELECT') && !o.text.toUpperCase().includes('SELECIONE')); })()`);
            continue; 
          }
          
          const label = FIELD_NAMES[setupState.id] || setupState.id;
          log(`Selecionando ${label}...`);
          log(`${label}: ${setupState.opt.text} ✔`);
          atualizarLogScraping(logId, { status: 'extraindo_dados', mensagem: `${label}: ${setupState.opt.text} selecionado(a).` });
          
          const nextDropdownId = setupState.nextId || null;
          const readyCond = nextDropdownId ? `return (() => { 
            const el = document.getElementById('${nextDropdownId}');
            if (!el) return true;
            const opts = Array.from(el.options);
            return opts.some(o => o.value !== '0' && !o.text.toUpperCase().includes('SELECT') && !o.text.toUpperCase().includes('SELECIONE'));
          })()` : null;
          
          await waitAspNetReady(win, `
            const nextEl = document.getElementById('${nextDropdownId}');
            if (nextEl) { nextEl.innerHTML = ''; }
            const el = document.getElementById('${setupState.id}');
            console.log('[Scraper-DOM] Disparando change em ${setupState.id} para valor', ${JSON.stringify(setupState.opt.val)});
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
            if (!el) return { sems: [] };
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
        if (semestresToScrape.length === 0) {
           log('Nenhum semestre válido encontrado. Finalizando...');
           atualizarLogScraping(logId, { status: 'concluido', mensagem: 'Nenhum semestre/dado encontrado para os filtros selecionados.' });
           scrapingState = 'DONE';
           continue;
        }
        
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
        `, `
          return (() => { 
             const nextEl = document.getElementById('rptViewer_ctl00_ctl13_ddValue');
             return nextEl && nextEl.options.length > 0;
          })();
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
            if (!el) return { turmas: [] };
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

          const turmaEl = document.getElementById('rptViewer_ctl00_ctl13_ddValue');
          if (turmaEl) {
             turmaEl.value = ${JSON.stringify(currentTurma.val)};
          }
          
          setTimeout(() => {
             const btn = document.getElementById('rptViewer_ctl00_ctl00');
             if (btn) {
                console.log('[Scraper-DOM] Clicando no botão View Report...');
                btn.click();
             }
          }, 500);
        `);
        
        scrapingState = 'WAIT_IFRAME_REPORT';
      }

      else if (scrapingState === 'WAIT_IFRAME_REPORT') {
        atualizarLogScraping(logId, { status: 'extraindo_dados', mensagem: `Aguardando carregamento do relatório para turma ${currentTurma.text}...` });
        
        let iframeState = null;
        const startTime = Date.now();
        const markerKey = (currentSemestre ? currentSemestre.val + ':' : '') + currentTurma.val;
        
        while (!isCancelled()) {
           if (win.isDestroyed()) { iframeState = { error: 'destroyed' }; break; }
           if (Date.now() - startTime > timeoutMs) { iframeState = { error: 'iframe_not_found_timeout' }; break; }
           
           const extractResult = await win.webContents.executeJavaScript(`
              (() => {
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
                    
                    if (!iframe) return { status: 'waiting', msg: 'Iframe não encontrado.' };
                    
                    let doc = null;
                    try { doc = iframe.contentDocument; } catch(e) { }
                    if (!doc || !doc.body) return { status: 'waiting', msg: 'doc ou doc.body inacessível.' };
                    
                    try {
                      const subFrame = doc.getElementById('report');
                      if (subFrame && subFrame.contentDocument && subFrame.contentDocument.body) {
                         doc = subFrame.contentDocument;
                      }
                    } catch(e) { }
                    
                    const scrapedVal = doc.body.getAttribute('data-scraped-turma');
                    if (scrapedVal === "${markerKey}") return { status: 'waiting', msg: 'Turma já extraída no DOM (marker matched).' };

                    if (doc.readyState !== 'complete') return { status: 'waiting', msg: 'readyState não é complete.' };

                    try {
                       if (typeof $find === 'function') {
                          const viewer = $find('rptViewer');
                          if (viewer && typeof viewer.get_isLoading === 'function' && viewer.get_isLoading()) {
                             return { status: 'waiting', msg: 'viewer.get_isLoading() é true.' };
                          }
                       }
                    } catch(e) {}
                    
                    const isVisible = (el) => {
                      if (!el) return false;
                      const style = el.ownerDocument && el.ownerDocument.defaultView ? el.ownerDocument.defaultView.getComputedStyle(el) : null;
                      if (!style) return true;
                      return style.display !== 'none' && style.visibility !== 'hidden';
                    };
                    
                    const waitPanel = doc.getElementById('AsyncWait_Wait') || doc.querySelector('[id$="_AsyncWait_Wait"], div[id*="AsyncWait"]');
                    if (isVisible(waitPanel)) return { status: 'waiting', msg: 'waitPanel está visível.' };

                    const allTables = Array.from(doc.querySelectorAll('table'));
                    if (allTables.length === 0) return { status: 'waiting', msg: 'Nenhuma tabela encontrada no doc.' };
                    
                    const newTables = allTables.filter(t => !t.hasAttribute('data-old-report'));
                    if (newTables.length === 0) return { status: 'waiting', msg: 'Todas as tabelas são velhas (data-old-report).' };

                    const rawTrs = newTables.flatMap(t => Array.from(t.querySelectorAll('tr')));
                    const uniqueTrs = Array.from(new Set(rawTrs));
                    const trs = uniqueTrs.filter(tr => {
                      const tds = tr.querySelectorAll('td');
                      if (tds.length < 4) return false;
                      return /^\\d{10,}$/.test(tds[0].innerText.trim());
                    });
                    
                    if (trs.length === 0) {
                       return { status: 'empty', foundId };
                    }
                    
                    doc.body.setAttribute('data-scraped-turma', "${markerKey}");
                    
                    const alunos = [];
                    trs.forEach(tr => {
                      const tds = tr.querySelectorAll('td');
                      const matricula = tds[0].innerText.trim();
                      const nome = tds[1].innerText.trim();
                      if (nome && matricula) {
                        alunos.push({ nome, matricula, turma_nome: "${currentTurma.text}" });
                      }
                    });
                    
                    return { status: 'success', alunos, foundId };
                 } catch (e) {
                    return { status: 'waiting', msg: 'Erro: ' + e.message };
                 }
              })()
           `).catch(e => ({ status: 'waiting', msg: 'ExecuteScript Error: ' + e.message }));
           
           if (extractResult && extractResult.status === 'success') {
              iframeState = { error: null, alunos: extractResult.alunos, foundId: extractResult.foundId };
              break;
           } else if (extractResult && extractResult.status === 'empty') {
              // Wait 2 extra seconds to see if it's just rendering
              await delay(2000);
              const recheck = await win.webContents.executeJavaScript(`
                 (() => {
                    try {
                       const doc = document.getElementById('${extractResult.foundId}').contentDocument;
                       const allTables = Array.from(doc.querySelectorAll('table')).filter(t => !t.hasAttribute('data-old-report'));
                       const trs = allTables.flatMap(t => Array.from(t.querySelectorAll('tr'))).filter(tr => {
                         const tds = tr.querySelectorAll('td');
                         return tds.length >= 4 && /^\\d{10,}$/.test(tds[0].innerText.trim());
                       });
                       if (trs.length > 0) {
                          doc.body.setAttribute('data-scraped-turma', "${markerKey}");
                          const alunos = [];
                          trs.forEach(tr => {
                            const tds = tr.querySelectorAll('td');
                            const matricula = tds[0].innerText.trim();
                            const nome = tds[1].innerText.trim();
                            if (nome && matricula) alunos.push({ nome, matricula, turma_nome: "${currentTurma.text}" });
                          });
                          return { status: 'success', alunos, foundId: '${extractResult.foundId}' };
                       }
                    } catch(e) {}
                    return { status: 'empty' };
                 })()
              `).catch(() => ({ status: 'empty' }));
              
              if (recheck && recheck.status === 'success') {
                 iframeState = { error: null, alunos: recheck.alunos, foundId: recheck.foundId };
              } else {
                 iframeState = { error: 'table_not_found', html: '', foundId: extractResult.foundId };
              }
              break;
           }
           
           if (extractResult && extractResult.msg) {
              console.log('[Scraper-DOM] ' + extractResult.msg);
           }
           
           await delay(1000);
        }
        
        if (isCancelled()) {
           iframeState = { error: 'cancelled' };
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
      try {
         if (win && win.webContents) {
            const dumpHtml = await win.webContents.executeJavaScript(`document.documentElement.outerHTML`);
            const dumpPath = require('path').join(require('electron').app.getPath('userData'), 'data', 'error_dump.html');
            require('fs').writeFileSync(dumpPath, dumpHtml, 'utf-8');
            console.error('[Scraper] HTML da página de erro salvo em:', dumpPath);
         }
      } catch(e) { console.error('Erro ao salvar dump HTML:', e); }
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
