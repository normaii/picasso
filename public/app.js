document.addEventListener('DOMContentLoaded', () => {
  // ==========================================
  // Navegação de Abas
  // ==========================================
  const navItems = document.querySelectorAll('.nav-item');
  const viewSections = document.querySelectorAll('.view-section');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      // Remover active de todos
      navItems.forEach(nav => nav.classList.remove('active'));
      viewSections.forEach(sec => sec.classList.remove('active'));

      // Adicionar active no clicado
      item.classList.add('active');
      const targetId = item.getAttribute('data-target');
      document.getElementById(targetId).classList.add('active');

      // Se entrou na aba de emissão, carrega as turmas
      if (targetId === 'view-emit') {
        carregarTurmas();
      }
    });
  });

  // ==========================================
  // Lógica de Configurações
  // ==========================================
  const formConfig = document.getElementById('form-config');
  const inputEscolaNome = document.getElementById('escola-nome');
  const inputEscolaLogo = document.getElementById('escola-logo');

  // Ao abrir, tenta buscar configurações salvas no LocalStorage ou via API
  // Para V1, usaremos localStorage no renderer
  const storedNome = localStorage.getItem('escolaNome');
  const storedLogo = localStorage.getItem('escolaLogo');
  
  if (storedNome) inputEscolaNome.value = storedNome;
  if (storedLogo) inputEscolaLogo.value = storedLogo;

  formConfig.addEventListener('submit', (e) => {
    e.preventDefault();
    localStorage.setItem('escolaNome', inputEscolaNome.value);
    localStorage.setItem('escolaLogo', inputEscolaLogo.value);
    alert('Configurações salvas com sucesso!');
  });

  // ==========================================
  // Lógica de Sincronização / Scraping
  // ==========================================
  // Versão Dinâmica (IPC)
  // ==========================================
  if (window.picasso && window.picasso.getVersion) {
    window.picasso.getVersion().then(v => {
      document.getElementById('app-version-label').innerText = `Versão ${v}`;
    });
  }

  // ==========================================
  // ABA: Sincronização (Scraper)
  // ==========================================
  const btnSync = document.getElementById('btn-iniciar-sync');
  const logContainer = document.getElementById('log-container');
  const logOutput = document.getElementById('log-output');
  const statTotalAlunos = document.getElementById('stat-total-alunos');
  const statTotalTurmas = document.getElementById('stat-total-turmas');

  let syncPollingInterval = null;

  btnSync.addEventListener('click', async () => {
    btnSync.disabled = true;
    logContainer.style.display = 'block';
    logOutput.innerHTML = '<div class="log-line">> Aguardando login manual no sistema...</div>';
    
    // Abre a janela de login via IPC
    if (window.picasso && window.picasso.openLogin) {
      window.picasso.openLogin();
    } else {
      adicionarLog(`[ERRO] Integração com Electron não disponível.`, true);
      btnSync.disabled = false;
    }
  });

  // Escuta o sucesso do login via IPC
  if (window.picasso && window.picasso.onLoginSuccess) {
    window.picasso.onLoginSuccess(async (cookies) => {
      adicionarLog('Login detectado com sucesso! Iniciando extração...');
      try {
        const res = await fetch('http://localhost:3000/api/scraping/iniciar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cookies })
        });
        const data = await res.json();
        
        if (res.ok) {
          adicionarLog(data.mensagem);
          iniciarPollingDeScraping();
        } else {
          adicionarLog(`[ERRO] ${data.erro}`, true);
          btnSync.disabled = false;
        }
      } catch (err) {
        adicionarLog(`[FALHA DE REDE] Servidor não responde.`, true);
        btnSync.disabled = false;
      }
    });
  }

  function adicionarLog(texto, isError = false) {
    const div = document.createElement('div');
    div.className = 'log-line';
    div.style.color = isError ? '#f87171' : '#38bdf8';
    div.innerText = `> ${texto}`;
    logOutput.appendChild(div);
    // Rolagem automática para baixo
    logOutput.scrollTop = logOutput.scrollHeight;
  }

  function iniciarPollingDeScraping() {
    if (syncPollingInterval) clearInterval(syncPollingInterval);
    
    syncPollingInterval = setInterval(async () => {
      try {
        const res = await fetch('http://localhost:3000/api/scraping/status');
        const data = await res.json();
        
        if (data && data.scraping) {
          const s = data.scraping;
          if (s.status === 'processando') {
            adicionarLog(`Extraindo... Turmas: ${s.progresso_turmas} | Alunos: ${s.progresso_alunos}`);
          } else if (s.status === 'concluido') {
            adicionarLog(`Sincronização concluída! Total Alunos: ${s.total_alunos}`, false);
            clearInterval(syncPollingInterval);
            btnSync.disabled = false;
            atualizarEstatisticas(s.total_alunos, s.progresso_turmas);
          } else if (s.status === 'erro') {
            adicionarLog(`Erro no scraping: ${s.erro}`, true);
            clearInterval(syncPollingInterval);
            btnSync.disabled = false;
          }
        }
      } catch (err) {
        // Ignora erros temporários de rede
      }
    }, 2000); // Polling a cada 2 segundos
  }

  function atualizarEstatisticas(alunos, turmas) {
    statTotalAlunos.innerText = alunos || '0';
    statTotalTurmas.innerText = turmas || '0';
  }

  // ==========================================
  // Lógica de Emissão (PDF)
  // ==========================================
  const gridTurmas = document.getElementById('grid-turmas');
  const bannerStatus = document.getElementById('pdf-status-banner');
  const textStatus = document.getElementById('pdf-status-text');
  const alertBanner = document.getElementById('pdf-alert-banner');
  
  let pdfPollingInterval = null;

  async function carregarTurmas() {
    try {
      const res = await fetch('http://localhost:3000/api/turmas');
      const data = await res.json();
      
      if (!data.turmas || data.turmas.length === 0) {
        gridTurmas.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #7f8c8d; padding: 2rem;">Nenhuma turma encontrada. Execute a sincronização primeiro.</div>`;
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

      // Re-associa eventos
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
    const nome = localStorage.getItem('escolaNome') || 'Escola Padrão';
    const logo = localStorage.getItem('escolaLogo') || '';

    bannerStatus.style.display = 'flex';
    alertBanner.style.display = 'none';
    textStatus.innerText = `Gerando PDF para a turma ${turma}...`;

    try {
      const res = await fetch('http://localhost:3000/api/pdf/gerar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turma, escolaNome: nome, logoUrl: logo })
      });
      
      if (res.ok) {
        monitorarStatusPDF();
      } else {
        mostrarAlertaPDF('Erro ao contatar API de geração', true);
      }
    } catch (err) {
      mostrarAlertaPDF('Falha na comunicação com o sistema interno.', true);
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
      } catch (err) {
        // ...
      }
    }, 1500);
  }

  function mostrarAlertaPDF(msg, isError) {
    bannerStatus.style.display = 'none';
    alertBanner.style.display = 'block';
    alertBanner.className = `alert mt-4 ${isError ? 'error' : 'success'}`;
    alertBanner.innerText = msg;
  }
});
