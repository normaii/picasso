document.addEventListener('DOMContentLoaded', () => {
  // ==========================================
  // Estado Global da Sessão e Aplicação
  // ==========================================
  let activeSessionCookies = null;
  let syncGeralActive = false;
  let syncGeralPhase = null; // 'add' | 'cdf'

  // ==========================================
  // Navegação de Abas e Telas
  // ==========================================
  const navItems = document.querySelectorAll('.nav-item');
  const viewSections = document.querySelectorAll('.view-section');

  function navegarPara(targetId) {
    navItems.forEach(nav => {
      if (nav.getAttribute('data-target') === targetId) {
        nav.classList.add('active');
      } else {
        nav.classList.remove('active');
      }
    });

    viewSections.forEach(sec => {
      if (sec.id === targetId) {
        sec.classList.add('active');
      } else {
        sec.classList.remove('active');
      }
    });

    // Gatilhos específicos por tela
    if (targetId === 'view-home') {
      atualizarStatusHome();
    } else if (targetId === 'view-add') {
      carregarDadosAdd();
    } else if (targetId === 'view-cdf') {
      carregarDadosCdf();
    } else if (targetId === 'view-gdi') {
      carregarTurmasGdi();
    }
  }

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetId = item.getAttribute('data-target');
      navegarPara(targetId);
    });
  });

  // Botões de navegação rápida (ex: nos cards de módulos da Home)
  document.querySelectorAll('.btn-navigate').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetId = e.currentTarget.getAttribute('data-target');
      if (targetId) navegarPara(targetId);
    });
  });

  // ==========================================
  // Versão Dinâmica (IPC) e Checagem de Updates
  // ==========================================
  if (window.picasso && window.picasso.getVersion) {
    window.picasso.getVersion().then(v => {
      const versionLabel = document.getElementById('app-version-label');
      if (versionLabel) versionLabel.innerText = `Versão ${v}`;
      checkUpdates(v);
    });
  }

  async function checkUpdates(currentVersion) {
    const container = document.getElementById('update-status-container');
    if (!container || !window.picasso.getLatestRelease) return;

    try {
      const release = await window.picasso.getLatestRelease();
      if (!release) {
        container.innerHTML = `<div style="color: #f87171;"><i class="ph ph-warning"></i> Falha ao verificar atualizações.</div>`;
        return;
      }

      const cleanCurrent = currentVersion.replace('v', '');
      const cleanLatest = release.version.replace('v', '');

      if (cleanCurrent === cleanLatest) {
        container.innerHTML = `
          <div style="display: flex; align-items: center; gap: 0.75rem; color: #10b981;">
            <i class="ph ph-check-circle" style="font-size: 1.5rem;"></i>
            <span>Você está usando a versão mais recente (${release.version}).</span>
          </div>
        `;
      } else {
        container.innerHTML = `
          <div style="display: flex; align-items: center; gap: 0.75rem; color: #f59e0b;">
            <i class="ph ph-warning-circle" style="font-size: 1.5rem;"></i>
            <span>Nova versão <strong>${release.version}</strong> disponível!</span>
            <button id="btn-download-update" class="btn btn-primary" style="margin-left: auto; padding: 0.5rem 1rem;">
              Baixar Atualização
            </button>
          </div>
        `;

        document.getElementById('btn-download-update').addEventListener('click', (e) => {
          e.preventDefault();
          window.picasso.openExternalUrl(release.url);
        });
      }
    } catch (e) {
      console.warn('Erro ao checar atualizações:', e);
    }
  }

  // ==========================================
  // Lógica de Configurações
  // ==========================================
  const formConfig = document.getElementById('form-config');
  const inputEscolaNome = document.getElementById('escola-nome');
  const inputEscolaLogo = document.getElementById('escola-logo');

  async function carregarConfiguracoes() {
    try {
      const res = await fetch('http://localhost:3000/api/config');
      if (res.ok) {
        const config = await res.json();
        if (inputEscolaNome && config.escolaNome) inputEscolaNome.value = config.escolaNome;
        if (inputEscolaLogo && config.escolaLogo) inputEscolaLogo.value = config.escolaLogo;
      }
    } catch (e) {
      console.warn('Erro ao carregar configurações da API:', e);
    }
  }

  if (formConfig) {
    formConfig.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const novasConfigs = {
        escolaNome: inputEscolaNome.value,
        escolaLogo: inputEscolaLogo.value
      };

      try {
        const res = await fetch('http://localhost:3000/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(novasConfigs)
        });
        
        if (res.ok) {
          alert('Configurações salvas com sucesso!');
        } else {
          const errData = await res.json();
          alert(errData.erro || 'Erro ao salvar as configurações.');
        }
      } catch (err) {
        alert('Erro de comunicação ao salvar configurações.');
      }
    });
  }

  // ========================================================
  // TELA INICIAL (Home): Autenticação, Status e Sinc Geral
  // ========================================================
  const btnHomeLogin = document.getElementById('btn-home-login');
  const btnHomeRelogin = document.getElementById('btn-home-relogin');
  const authStateDisconnected = document.getElementById('auth-state-disconnected');
  const authStateConnected = document.getElementById('auth-state-connected');
  const sessionLoginTime = document.getElementById('session-login-time');
  const badgeAddStatus = document.getElementById('badge-add-status');
  const badgeCdfStatus = document.getElementById('badge-cdf-status');
  const homeStatAlunos = document.getElementById('home-stat-alunos');
  const homeStatFotos = document.getElementById('home-stat-fotos');
  const btnSyncGeral = document.getElementById('btn-sync-geral');
  const btnCancelSyncGeral = document.getElementById('btn-cancel-sync-geral');
  const estimateNotRecommended = document.getElementById('estimate-not-recommended');
  const estimateAvailable = document.getElementById('estimate-available');
  const estimateText = document.getElementById('estimate-text');
  const syncGeralProgressContainer = document.getElementById('sync-geral-progress-container');
  const syncGeralProgressBar = document.getElementById('sync-geral-progress-bar');
  const syncGeralPhaseText = document.getElementById('sync-geral-phase-text');
  const syncGeralPctText = document.getElementById('sync-geral-pct-text');
  const logHomeContainer = document.getElementById('log-home-container');
  const logHomeOutput = document.getElementById('log-home-output');

  function iniciarLogin() {
    if (window.picasso && window.picasso.openLogin) {
      window.picasso.openLogin();
    } else {
      alert('Integração com Electron não disponível.');
    }
  }

  if (btnHomeLogin) btnHomeLogin.addEventListener('click', iniciarLogin);
  if (btnHomeRelogin) btnHomeRelogin.addEventListener('click', iniciarLogin);

  // Listener para captura dos cookies de sessão após login
  if (window.picasso && window.picasso.onLoginSuccess) {
    window.picasso.onLoginSuccess((cookies) => {
      activeSessionCookies = cookies;
      const horaStr = new Date().toLocaleTimeString('pt-BR');
      
      if (authStateDisconnected) authStateDisconnected.style.display = 'none';
      if (authStateConnected) authStateConnected.style.display = 'block';
      if (sessionLoginTime) sessionLoginTime.innerText = `Autenticado às ${horaStr}`;

      atualizarStatusHome();
      adicionarLogHome('Autenticação no Conexão Educação validada com sucesso.');
    });
  }

  async function atualizarStatusHome() {
    try {
      // 1. Alunos e Turmas
      const resAlunos = await fetch('http://localhost:3000/api/alunos?limite=1');
      const dataAlunos = await resAlunos.json();
      const totalAlunos = dataAlunos.total || 0;

      if (homeStatAlunos) {
        homeStatAlunos.innerText = `${totalAlunos} aluno(s) cadastrado(s)`;
      }

      // 2. Fotos
      const resFotos = await fetch('http://localhost:3000/api/fotos/estatisticas');
      const dataFotos = await resFotos.json();
      const estFotos = (dataFotos && dataFotos.estatisticas) ? dataFotos.estatisticas : {};
      const totalFotosSalvas = (estFotos.comFotoReal || 0) + (estFotos.semFotoOficial || 0);

      if (homeStatFotos) {
        homeStatFotos.innerText = `${totalFotosSalvas} foto(s) processada(s)`;
      }

      // 3. Atualizar Badges de Disponibilidade
      if (badgeAddStatus) {
        if (activeSessionCookies) {
          badgeAddStatus.className = 'badge-status available';
          badgeAddStatus.innerText = 'Disponível';
        } else {
          badgeAddStatus.className = 'badge-status pending';
          badgeAddStatus.innerText = 'Requer Login';
        }
      }

      if (badgeCdfStatus) {
        if (!activeSessionCookies) {
          badgeCdfStatus.className = 'badge-status unavailable';
          badgeCdfStatus.innerText = 'Indisponível (Login)';
        } else if (totalAlunos === 0) {
          badgeCdfStatus.className = 'badge-status unavailable';
          badgeCdfStatus.innerText = 'Indisponível (Sem alunos)';
        } else {
          badgeCdfStatus.className = 'badge-status available';
          badgeCdfStatus.innerText = 'Disponível';
        }
      }

      // 4. Estimativa de Sincronização Geral
      const resEst = await fetch('http://localhost:3000/api/sincronizacao/estimativa');
      const dataEst = await resEst.json();
      const est = (dataEst && dataEst.estimativa) ? dataEst.estimativa : null;

      if (est && est.temHistorico) {
        if (estimateNotRecommended) estimateNotRecommended.style.display = 'none';
        if (estimateAvailable) {
          estimateAvailable.style.display = 'flex';
          if (estimateText) {
            estimateText.innerText = `Tempo estimado com base na última execução: ~${est.tempoTotalMin} min (${est.totalAlunos} alunos).`;
          }
        }
      } else {
        if (estimateAvailable) estimateAvailable.style.display = 'none';
        if (estimateNotRecommended) estimateNotRecommended.style.display = 'flex';
      }

      // 5. Habilitar botão Sincronização Geral
      if (btnSyncGeral && !syncGeralActive) {
        btnSyncGeral.disabled = !activeSessionCookies;
      }
    } catch (err) {
      console.warn('Erro ao atualizar status da Home:', err);
    }
  }

  function adicionarLogHome(texto, isError = false) {
    if (!logHomeOutput) return;
    if (logHomeContainer) logHomeContainer.style.display = 'block';

    const ts = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const div = document.createElement('div');
    div.className = 'log-line';
    div.style.color = isError ? '#f87171' : '#38bdf8';
    div.innerText = `[${ts}] ${texto}`;
    logHomeOutput.appendChild(div);
    logHomeOutput.scrollTop = logHomeOutput.scrollHeight;
  }

  // Execução do Pipeline de Sincronização Geral (AdD -> CdF)
  if (btnSyncGeral) {
    btnSyncGeral.addEventListener('click', async () => {
      if (!activeSessionCookies) {
        alert('É necessário conectar a sessão antes de iniciar.');
        return;
      }

      syncGeralActive = true;
      btnSyncGeral.disabled = true;
      if (btnCancelSyncGeral) btnCancelSyncGeral.style.display = 'inline-flex';

      if (syncGeralProgressContainer) syncGeralProgressContainer.style.display = 'block';
      if (syncGeralProgressBar) syncGeralProgressBar.style.width = '0%';
      if (syncGeralPctText) syncGeralPctText.innerText = '0%';
      if (syncGeralPhaseText) syncGeralPhaseText.innerText = 'Fase 1/2: Aquisição de Dados (AdD)';
      if (logHomeOutput) logHomeOutput.innerHTML = '';

      adicionarLogHome('Iniciando Sincronização Geral (AdD + CdF)...');
      syncGeralPhase = 'add';

      // 1. Inicia AdD
      try {
        const resAdd = await fetch('http://localhost:3000/api/scraping/iniciar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cookies: activeSessionCookies })
        });
        const dataAdd = await resAdd.json();

        if (!resAdd.ok) {
          adicionarLogHome(`[ERRO AdD] ${dataAdd.erro || 'Falha ao iniciar scraping'}`, true);
          finalizarSyncGeral(false);
          return;
        }

        adicionarLogHome(dataAdd.mensagem || 'Scraping de turmas e alunos iniciado.');
        monitorarFaseAddParaSyncGeral();
      } catch (err) {
        adicionarLogHome(`[FALHA] Comunicação interrompida: ${err.message}`, true);
        finalizarSyncGeral(false);
      }
    });
  }

  let syncGeralInterval = null;
  function monitorarFaseAddParaSyncGeral() {
    if (syncGeralInterval) clearInterval(syncGeralInterval);

    syncGeralInterval = setInterval(async () => {
      try {
        const res = await fetch('http://localhost:3000/api/scraping/status');
        const data = await res.json();
        const s = data.scraping;

        if (!s) return;

        if (s.status === 'em_andamento') {
          if (s.mensagem) adicionarLogHome(`[AdD] ${s.mensagem}`);
        } else if (s.status === 'concluido') {
          clearInterval(syncGeralInterval);
          adicionarLogHome(`Fase 1 (AdD) concluída! ${s.total_alunos} alunos identificados.`);
          
          if (syncGeralProgressBar) syncGeralProgressBar.style.width = '45%';
          if (syncGeralPctText) syncGeralPctText.innerText = '45%';

          // Inicia Fase 2: CdF
          iniciarFaseCdfParaSyncGeral();
        } else if (s.status === 'erro' || s.status === 'cancelado') {
          clearInterval(syncGeralInterval);
          adicionarLogHome(`Fase 1 (AdD) interrompida: ${s.erro || s.mensagem}`, true);
          finalizarSyncGeral(false);
        }
      } catch (e) {}
    }, 2000);
  }

  async function iniciarFaseCdfParaSyncGeral() {
    syncGeralPhase = 'cdf';
    if (syncGeralPhaseText) syncGeralPhaseText.innerText = 'Fase 2/2: Captura de Fotos (CdF)';
    adicionarLogHome('Iniciando Fase 2 (CdF): Download de fotos de todas as turmas...');

    try {
      const resCdf = await fetch('http://localhost:3000/api/fotos/iniciar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turma: 'TODAS', concurrency: 2 })
      });
      const dataCdf = await resCdf.json();

      if (!resCdf.ok) {
        adicionarLogHome(`[ERRO CdF] ${dataCdf.erro || 'Falha ao iniciar fotos'}`, true);
        finalizarSyncGeral(false);
        return;
      }

      adicionarLogHome(dataCdf.mensagem || 'Processo de download de fotos iniciado.');
      monitorarFaseCdfParaSyncGeral();
    } catch (err) {
      adicionarLogHome(`[FALHA] Comunicação interrompida: ${err.message}`, true);
      finalizarSyncGeral(false);
    }
  }

  function monitorarFaseCdfParaSyncGeral() {
    if (syncGeralInterval) clearInterval(syncGeralInterval);

    syncGeralInterval = setInterval(async () => {
      try {
        const res = await fetch('http://localhost:3000/api/fotos/status');
        const data = await res.json();
        const f = data.fotos;

        if (!f) return;

        if (f.total > 0 && syncGeralProgressBar && syncGeralPctText) {
          const fotosPct = Math.round((f.processados / f.total) * 55);
          const totalPct = Math.min(100, 45 + fotosPct);
          syncGeralProgressBar.style.width = totalPct + '%';
          syncGeralPctText.innerText = totalPct + '%';
        }

        if (f.status === 'concluido') {
          clearInterval(syncGeralInterval);
          if (syncGeralProgressBar) syncGeralProgressBar.style.width = '100%';
          if (syncGeralPctText) syncGeralPctText.innerText = '100%';
          adicionarLogHome('Sincronização Geral finalizada com sucesso!');
          finalizarSyncGeral(true);
        } else if (f.status === 'erro' || f.status === 'cancelado') {
          clearInterval(syncGeralInterval);
          adicionarLogHome(`Fase 2 (CdF) interrompida: ${f.mensagem}`, true);
          finalizarSyncGeral(false);
        }
      } catch (e) {}
    }, 2000);
  }

  function finalizarSyncGeral(sucesso) {
    syncGeralActive = false;
    syncGeralPhase = null;
    if (btnSyncGeral) btnSyncGeral.disabled = !activeSessionCookies;
    if (btnCancelSyncGeral) btnCancelSyncGeral.style.display = 'none';
    if (syncGeralPhaseText) {
      syncGeralPhaseText.innerText = sucesso ? 'Sincronização concluída!' : 'Sincronização interrompida';
    }
    atualizarStatusHome();
  }

  if (btnCancelSyncGeral) {
    btnCancelSyncGeral.addEventListener('click', async () => {
      if (syncGeralPhase === 'add') {
        await fetch('http://localhost:3000/api/scraping/cancelar', { method: 'POST' }).catch(() => {});
      } else if (syncGeralPhase === 'cdf') {
        await fetch('http://localhost:3000/api/fotos/cancelar', { method: 'POST' }).catch(() => {});
      }
      adicionarLogHome('Cancelamento solicitado...', true);
    });
  }

  // ========================================================
  // MÓDULO AdD (Aquisição de Dados)
  // ========================================================
  const btnSync = document.getElementById('btn-iniciar-sync');
  const btnCancelar = document.getElementById('btn-cancelar-sync');
  const logContainer = document.getElementById('log-container');
  const logOutput = document.getElementById('log-output');
  const statTotalAlunos = document.getElementById('stat-total-alunos');
  const statTotalTurmas = document.getElementById('stat-total-turmas');

  let syncPollingInterval = null;
  let lastLogMessage = '';

  async function carregarDadosAdd() {
    try {
      const resAlunos = await fetch('http://localhost:3000/api/alunos?limite=1');
      const dataAlunos = await resAlunos.json();
      if (statTotalAlunos) statTotalAlunos.innerText = dataAlunos.total || 0;

      const resTurmas = await fetch('http://localhost:3000/api/turmas');
      const dataTurmas = await resTurmas.json();
      if (statTotalTurmas) statTotalTurmas.innerText = (dataTurmas.turmas || []).length;
    } catch (e) {}
  }

  function adicionarLogAdd(texto, isError = false) {
    if (!logOutput) return;
    const ts = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const div = document.createElement('div');
    div.className = 'log-line';
    div.style.color = isError ? '#f87171' : '#38bdf8';
    div.innerText = `[${ts}] ${texto}`;
    logOutput.appendChild(div);
    logOutput.scrollTop = logOutput.scrollHeight;
  }

  if (btnSync) {
    btnSync.addEventListener('click', async () => {
      // Se já possui cookies de sessão válidos, inicia imediatamente
      if (activeSessionCookies) {
        dispararScrapingAdd(activeSessionCookies);
        return;
      }

      // Senão, abre a janela de login
      btnSync.disabled = true;
      if (logContainer) logContainer.style.display = 'block';
      if (logOutput) logOutput.innerHTML = '<div class="log-line">> Aguardando login manual no Conexão Educação...</div>';
      lastLogMessage = '';
      if (btnCancelar) btnCancelar.style.display = 'inline-flex';

      if (window.picasso && window.picasso.openLogin) {
        window.picasso.openLogin();
      } else {
        adicionarLogAdd('[ERRO] Integração com Electron não disponível.', true);
        btnSync.disabled = false;
      }
    });
  }

  async function dispararScrapingAdd(cookies) {
    if (btnSync) btnSync.disabled = true;
    if (logContainer) logContainer.style.display = 'block';
    if (btnCancelar) btnCancelar.style.display = 'inline-flex';
    adicionarLogAdd('Iniciando varredura de alunos e turmas (AdD)...');

    try {
      const res = await fetch('http://localhost:3000/api/scraping/iniciar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookies })
      });
      const data = await res.json();
      
      if (res.ok) {
        adicionarLogAdd(data.mensagem);
        iniciarPollingDeScraping();
      } else {
        adicionarLogAdd(`[ERRO] ${data.erro}`, true);
        if (btnSync) btnSync.disabled = false;
        if (btnCancelar) btnCancelar.style.display = 'none';
      }
    } catch (err) {
      adicionarLogAdd(`[FALHA DE REDE] Servidor não responde.`, true);
      if (btnSync) btnSync.disabled = false;
      if (btnCancelar) btnCancelar.style.display = 'none';
    }
  }

  if (btnCancelar) {
    btnCancelar.addEventListener('click', async () => {
      try {
        await fetch('http://localhost:3000/api/scraping/cancelar', { method: 'POST' });
        adicionarLogAdd('Solicitação de cancelamento enviada...', true);
        btnCancelar.disabled = true;
      } catch(e) {
        adicionarLogAdd('Falha ao enviar cancelamento.', true);
      }
    });
  }

  function iniciarPollingDeScraping() {
    if (syncPollingInterval) clearInterval(syncPollingInterval);
    
    syncPollingInterval = setInterval(async () => {
      try {
        const res = await fetch('http://localhost:3000/api/scraping/status');
        const data = await res.json();
        
        if (data && data.scraping) {
          const s = data.scraping;
          if (s.status === 'concluido') {
            adicionarLogAdd(`Varredura concluída com sucesso! Total Alunos: ${s.total_alunos}`, false);
            clearInterval(syncPollingInterval);
            if (btnSync) btnSync.disabled = false;
            if (btnCancelar) {
              btnCancelar.style.display = 'none';
              btnCancelar.disabled = false;
            }
            carregarDadosAdd();
            atualizarStatusHome();
          } else if (s.status === 'erro') {
            adicionarLogAdd(`Erro no scraping: ${s.erro || s.mensagem}`, true);
            clearInterval(syncPollingInterval);
            if (btnSync) btnSync.disabled = false;
            if (btnCancelar) {
              btnCancelar.style.display = 'none';
              btnCancelar.disabled = false;
            }
          } else if (s.status === 'cancelado') {
            adicionarLogAdd('Varredura cancelada pelo usuário.', true);
            clearInterval(syncPollingInterval);
            if (btnSync) btnSync.disabled = false;
            if (btnCancelar) {
              btnCancelar.style.display = 'none';
              btnCancelar.disabled = false;
            }
          } else {
            const msg = s.mensagem || 'Extraindo...';
            if (msg !== lastLogMessage) {
              lastLogMessage = msg;
              adicionarLogAdd(msg);
            }
          }
        }
      } catch (err) {}
    }, 2000);
  }

  // ========================================================
  // MÓDULO CdF (Captura de Fotos)
  // ========================================================
  const btnIniciarFotos = document.getElementById('btn-iniciar-fotos');
  const btnCancelarFotos = document.getElementById('btn-cancelar-fotos');
  const selectTurmaFotos = document.getElementById('select-turma-fotos');
  const selectConcurrencyFotos = document.getElementById('select-concurrency-fotos');
  const progressFotosContainer = document.getElementById('progress-fotos-container');
  const progressFotosBar = document.getElementById('progress-fotos-bar');
  const progressFotosText = document.getElementById('progress-fotos-text');
  const progressFotosPct = document.getElementById('progress-fotos-pct');
  const logFotosContainer = document.getElementById('log-fotos-container');
  const logFotosOutput = document.getElementById('log-fotos-output');
  const statFotoCom = document.getElementById('stat-foto-com');
  const statFotoSem = document.getElementById('stat-foto-sem');
  const statFotoPendentes = document.getElementById('stat-foto-pendentes');

  let fotosPollingInterval = null;

  async function carregarDadosCdf() {
    try {
      // 1. Turmas cadastradas
      const resTurmas = await fetch('http://localhost:3000/api/turmas');
      const dataTurmas = await resTurmas.json();
      const turmas = dataTurmas.turmas || [];

      if (selectTurmaFotos) {
        const valorAtual = selectTurmaFotos.value;
        selectTurmaFotos.innerHTML = '<option value="TODAS">Todas as Turmas (Completo)</option>' +
          turmas.map(t => `<option value="${t}">Turma ${t}</option>`).join('');
        if (turmas.includes(valorAtual)) {
          selectTurmaFotos.value = valorAtual;
        }
      }

      // 2. Estatísticas de Fotos
      const resFotos = await fetch('http://localhost:3000/api/fotos/estatisticas');
      const dataFotos = await resFotos.json();
      if (dataFotos && dataFotos.estatisticas) {
        const est = dataFotos.estatisticas;
        if (statFotoCom) statFotoCom.innerText = est.comFotoReal || 0;
        if (statFotoSem) statFotoSem.innerText = est.semFotoOficial || 0;
        if (statFotoPendentes) statFotoPendentes.innerText = est.pendentes || 0;
      }
    } catch (e) {
      console.error('Erro ao carregar dados do CdF:', e);
    }
  }

  function adicionarLogFoto(texto, isError = false) {
    if (!logFotosOutput) return;
    const ts = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const div = document.createElement('div');
    div.className = 'log-line';
    div.style.color = isError ? '#f87171' : '#38bdf8';
    div.innerText = `[${ts}] ${texto}`;
    logFotosOutput.appendChild(div);
    logFotosOutput.scrollTop = logFotosOutput.scrollHeight;
  }

  if (btnIniciarFotos) {
    btnIniciarFotos.addEventListener('click', async () => {
      const turma = selectTurmaFotos ? selectTurmaFotos.value : 'TODAS';
      const concurrency = selectConcurrencyFotos ? (parseInt(selectConcurrencyFotos.value) || 2) : 2;
      const checkForcar = document.getElementById('check-forcar-reprocessamento');
      const forcar = checkForcar ? checkForcar.checked : false;

      btnIniciarFotos.disabled = true;
      if (btnCancelarFotos) {
        btnCancelarFotos.style.display = 'inline-flex';
        btnCancelarFotos.disabled = false;
      }
      if (progressFotosContainer) progressFotosContainer.style.display = 'block';
      if (progressFotosBar) progressFotosBar.style.width = '0%';
      if (progressFotosText) progressFotosText.innerText = 'Iniciando download...';
      if (progressFotosPct) progressFotosPct.innerText = '0%';
      if (logFotosContainer) logFotosContainer.style.display = 'block';
      if (logFotosOutput) logFotosOutput.innerHTML = '<div class="log-line">> Conectando aos processos de extração...</div>';

      try {
        const res = await fetch('http://localhost:3000/api/fotos/iniciar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ turma, concurrency, forcar })
        });

        const data = await res.json();
        if (res.ok) {
          adicionarLogFoto(data.mensagem);
          iniciarPollingDeFotos();
        } else {
          adicionarLogFoto(`[ERRO] ${data.erro}`, true);
          btnIniciarFotos.disabled = false;
          if (btnCancelarFotos) btnCancelarFotos.style.display = 'none';
        }
      } catch (err) {
        adicionarLogFoto(`[FALHA DE REDE] Não foi possível iniciar o download de fotos.`, true);
        btnIniciarFotos.disabled = false;
        if (btnCancelarFotos) btnCancelarFotos.style.display = 'none';
      }
    });
  }

  if (btnCancelarFotos) {
    btnCancelarFotos.addEventListener('click', async () => {
      try {
        await fetch('http://localhost:3000/api/fotos/cancelar', { method: 'POST' });
        adicionarLogFoto('Solicitação de cancelamento de fotos enviada...', true);
        btnCancelarFotos.disabled = true;
      } catch (e) {
        adicionarLogFoto('Falha ao enviar cancelamento.', true);
      }
    });
  }

  function iniciarPollingDeFotos() {
    if (fotosPollingInterval) clearInterval(fotosPollingInterval);

    fotosPollingInterval = setInterval(async () => {
      try {
        const res = await fetch('http://localhost:3000/api/fotos/status');
        const data = await res.json();

        if (data && data.fotos) {
          const f = data.fotos;

          if (f.total > 0 && progressFotosBar && progressFotosPct && progressFotosText) {
            const pct = Math.min(100, Math.round((f.processados / f.total) * 100));
            progressFotosBar.style.width = pct + '%';
            progressFotosPct.innerText = pct + '%';
            progressFotosText.innerText = `Processando: ${f.processados} de ${f.total} fotos (${f.turma || ''})`;
          }

          if (f.estatisticasGerais) {
            if (statFotoCom) statFotoCom.innerText = f.estatisticasGerais.comFotoReal || 0;
            if (statFotoSem) statFotoSem.innerText = f.estatisticasGerais.semFotoOficial || 0;
            if (statFotoPendentes) statFotoPendentes.innerText = f.estatisticasGerais.pendentes || 0;
          }

          if (f.logs && f.logs.length > 0 && logFotosOutput) {
            logFotosOutput.innerHTML = f.logs.map(l => {
              const isErr = l.includes('⚠') || l.includes('⛔') || l.includes('Erro');
              const color = isErr ? '#f87171' : '#38bdf8';
              return `<div class="log-line" style="color: ${color};">${l}</div>`;
            }).join('');
            logFotosOutput.scrollTop = logFotosOutput.scrollHeight;
          }

          if (f.status === 'concluido') {
            adicionarLogFoto(f.mensagem || 'Download de fotos concluído com sucesso!');
            clearInterval(fotosPollingInterval);
            if (btnIniciarFotos) btnIniciarFotos.disabled = false;
            if (btnCancelarFotos) btnCancelarFotos.style.display = 'none';
            carregarDadosCdf();
            atualizarStatusHome();
          } else if (f.status === 'erro') {
            adicionarLogFoto(`Erro no processo de fotos: ${f.mensagem}`, true);
            clearInterval(fotosPollingInterval);
            if (btnIniciarFotos) btnIniciarFotos.disabled = false;
            if (btnCancelarFotos) btnCancelarFotos.style.display = 'none';
            carregarDadosCdf();
            atualizarStatusHome();
          } else if (f.status === 'cancelado') {
            adicionarLogFoto('Download de fotos cancelado pelo usuário.', true);
            clearInterval(fotosPollingInterval);
            if (btnIniciarFotos) btnIniciarFotos.disabled = false;
            if (btnCancelarFotos) btnCancelarFotos.style.display = 'none';
            carregarDadosCdf();
            atualizarStatusHome();
          }
        }
      } catch (err) {}
    }, 1500);
  }

  // ========================================================
  // MÓDULO GdI (Gerador de Identificação - Carteirinhas)
  // ========================================================
  const gridTurmas = document.getElementById('grid-turmas');
  const bannerStatus = document.getElementById('pdf-status-banner');
  const textStatus = document.getElementById('pdf-status-text');
  const alertBanner = document.getElementById('pdf-alert-banner');
  
  let pdfPollingInterval = null;

  async function carregarTurmasGdi() {
    if (!gridTurmas) return;
    try {
      const res = await fetch('http://localhost:3000/api/turmas');
      const data = await res.json();
      
      if (!data.turmas || data.turmas.length === 0) {
        gridTurmas.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #7f8c8d; padding: 2rem;">Nenhuma turma encontrada. Execute a sincronização no módulo AdD primeiro.</div>`;
        return;
      }

      gridTurmas.innerHTML = data.turmas.map(turma => `
        <div class="turma-card">
          <div class="turma-header">
            <span class="turma-nome">${turma}</span>
            <span class="turma-badge">Turma</span>
          </div>
          <button class="btn btn-primary btn-gerar-pdf" data-turma="${turma}">
            <i class="ph ph-printer"></i> Gerar PDF
          </button>
        </div>
      `).join('');

      document.querySelectorAll('.btn-gerar-pdf').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const t = e.currentTarget.getAttribute('data-turma');
          iniciarGeracaoPDF(t);
        });
      });
    } catch (err) {
      gridTurmas.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #e74c3c; padding: 2rem;">Erro ao carregar turmas.</div>`;
    }
  }

  async function iniciarGeracaoPDF(turma) {
    if (bannerStatus) bannerStatus.style.display = 'flex';
    if (alertBanner) alertBanner.style.display = 'none';
    if (textStatus) textStatus.innerText = `Gerando PDF para a turma ${turma}...`;

    try {
      const res = await fetch('http://localhost:3000/api/pdf/gerar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turma })
      });
      
      if (res.ok) {
        monitorarStatusPDF();
      } else {
        mostrarAlertaPDF('Erro ao contatar API de geração de PDF.', true);
      }
    } catch (err) {
      mostrarAlertaPDF('Falha na comunicação com o servidor interno.', true);
    }
  }

  function monitorarStatusPDF() {
    if (pdfPollingInterval) clearInterval(pdfPollingInterval);
    
    pdfPollingInterval = setInterval(async () => {
      try {
        const res = await fetch('http://localhost:3000/api/pdf/status');
        const data = await res.json();
        
        const s = data.status;
        if (s.status === 'concluido') {
          clearInterval(pdfPollingInterval);
          mostrarAlertaPDF(`Sucesso! O arquivo foi salvo em: ${s.arquivo}`, false);
        } else if (s.status === 'erro') {
          clearInterval(pdfPollingInterval);
          mostrarAlertaPDF(`Erro: ${s.erro}`, true);
        }
      } catch (err) {}
    }, 1500);
  }

  function mostrarAlertaPDF(msg, isError) {
    if (bannerStatus) bannerStatus.style.display = 'none';
    if (alertBanner) {
      alertBanner.style.display = 'block';
      alertBanner.className = `alert mt-4 ${isError ? 'error' : 'success'}`;
      alertBanner.innerText = msg;
    }
  }

  // ==========================================
  // Encerramento de Ciclo Letivo (PIC-3)
  // ==========================================
  const btnPurgeData = document.getElementById('btn-purge-data');
  const modalPurge = document.getElementById('modal-purge');
  const btnPurgeCancel = document.getElementById('btn-purge-cancel');
  const btnPurgeConfirm = document.getElementById('btn-purge-confirm');
  const inputPurgeConfirm = document.getElementById('input-purge-confirm');

  if (btnPurgeData && modalPurge) {
    btnPurgeData.addEventListener('click', () => {
      inputPurgeConfirm.value = '';
      btnPurgeConfirm.disabled = true;
      modalPurge.style.display = 'flex';
    });

    btnPurgeCancel.addEventListener('click', () => {
      modalPurge.style.display = 'none';
    });

    inputPurgeConfirm.addEventListener('input', (e) => {
      if (e.target.value.trim().toUpperCase() === 'ENCERRAR') {
        btnPurgeConfirm.disabled = false;
      } else {
        btnPurgeConfirm.disabled = true;
      }
    });

    btnPurgeConfirm.addEventListener('click', async () => {
      try {
        btnPurgeConfirm.disabled = true;
        btnPurgeConfirm.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Processando...';
        
        const res = await fetch('http://localhost:3000/api/system/archive', { method: 'POST' });
        const data = await res.json();
        
        if (res.ok) {
          modalPurge.style.display = 'none';
          alert('Encerramento de ciclo letivo concluído com sucesso!');
          carregarDadosAdd();
          carregarDadosCdf();
          atualizarStatusHome();
        } else {
          alert('Erro no expurgo: ' + (data.erro || 'Falha desconhecida.'));
        }
      } catch (err) {
        alert('Erro ao contatar API de arquivamento.');
      } finally {
        btnPurgeConfirm.innerHTML = '<i class="ph ph-trash"></i> Confirmar Expurgo';
        if (inputPurgeConfirm.value.trim().toUpperCase() === 'ENCERRAR') {
          btnPurgeConfirm.disabled = false;
        }
      }
    });
  }

  // ==========================================
  // Inicialização no Carregamento
  // ==========================================
  atualizarStatusHome();
  carregarDadosAdd();
  carregarDadosCdf();
  carregarConfiguracoes();
});
