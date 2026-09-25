// ============================================================
// Picasso — Download Automático de Fotos dos Alunos (photoFetcher)
// ============================================================
// Busca alunos sem foto no banco local, abre janelas ocultas
// no Electron (com cookies de sessão compartilhados), navega para
// Alunos.aspx, dispara o postback com a matrícula e extrai a foto.
// ============================================================

const { BrowserWindow, session } = require('electron');
const path = require('path');
const fs = require('fs');
const {
  getAlunosSemFoto,
  atualizarFotoAluno,
  marcarAlunoSemFoto,
  getEstatisticasFotos
} = require('../db/database');

const BASE_URL = process.env.SYSTEM_URL || 'https://conexao.educacao.rj.gov.br';

// Estado global do processo de download de fotos
let fetchStatus = {
  status: 'ocioso', // 'ocioso' | 'em_andamento' | 'concluido' | 'cancelado' | 'erro'
  total: 0,
  processados: 0,
  comFoto: 0,
  semFoto: 0,
  erros: 0,
  turma: null,
  alunoAtual: null,
  mensagem: null,
  logs: []
};

let cancelRequested = false;

function requestCancelPhotos() {
  cancelRequested = true;
  addLog('⛔ Solicitação de cancelamento de download de fotos recebida.', true);
}

function isPhotosCancelled() {
  return cancelRequested;
}

function getPhotoFetchStatus() {
  return {
    ...fetchStatus,
    estatisticasGerais: getEstatisticasFotos()
  };
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
const logStreamPath = path.join(dataDir, 'cdf_logs.txt');

function addLog(msg, isError = false) {
  const ts = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const entry = `[${ts}] ${msg}`;
  console.log(`[PhotoFetcher] ${entry}`);
  fetchStatus.mensagem = msg;
  fetchStatus.logs.push(entry);
  if (fetchStatus.logs.length > 100) {
    fetchStatus.logs.shift();
  }
  
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.appendFileSync(logStreamPath, entry + '\n', 'utf-8');
  } catch (e) {
    console.error('[PhotoFetcher] Erro ao salvar log no arquivo:', e);
  }
}

/**
 * Retorna o diretório seguro de fotos e garante que existe.
 */
function getFotosDir() {
  const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
  const fotosDir = path.join(dataDir, 'fotos');
  if (!fs.existsSync(fotosDir)) {
    fs.mkdirSync(fotosDir, { recursive: true });
  }
  return fotosDir;
}

/**
 * Garante que o avatar padrão esteja copiado na pasta de fotos e retorna o caminho.
 */
function getOrCopyDefaultAvatar() {
  const fotosDir = getFotosDir();
  const destAvatar = path.join(fotosDir, 'default_avatar.jpg');

  if (!fs.existsSync(destAvatar)) {
    const candidateSources = [
      path.join(__dirname, '..', '..', 'assets', 'default_avatar.jpg'),
      path.join(__dirname, '..', '..', 'public', 'assets', 'default_avatar.jpg')
    ];
    for (const src of candidateSources) {
      if (fs.existsSync(src)) {
        try {
          fs.copyFileSync(src, destAvatar);
          break;
        } catch (e) {
          console.error('[PhotoFetcher] Erro ao copiar avatar padrão:', e);
        }
      }
    }
  }

  return destAvatar;
}

/**
 * Processa a fila de alunos com um worker BrowserWindow específico.
 */
async function photoWorker(workerId, queue, defaultAvatarPath, fotosDir) {
  let win = null;

  try {
    addLog(`[Worker ${workerId}] Iniciando janela...`);
    win = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    // Suprime permissões de mídia (câmera/microfone) para evitar falhas do Windows Media Foundation MFT (0xC00D3704)
    win.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
      if (permission === 'media') return callback(false);
      callback(true);
    });

    // Desativa chamadas de getUserMedia na página do Conexão Educação
    win.webContents.on('did-start-loading', () => {
      win.webContents.executeJavaScript(`
        if (navigator.mediaDevices) {
          navigator.mediaDevices.getUserMedia = () => Promise.reject(new Error('webcam_disabled_in_picasso'));
        }
      `).catch(() => {});
    });

    // Suprime caixas de diálogo modais do ASP.NET (alert/confirm)
    win.webContents.on('dialog', (event) => {
      event.preventDefault();
    });

    const targetUrl = `${BASE_URL}/ConexaoEducacao/Academico/Alunos.aspx`;
    addLog(`[Worker ${workerId}] Carregando página base Alunos.aspx...`);
    await win.loadURL(targetUrl);
    await delay(3000);

    const currentUrl = win.webContents.getURL();
    const pageTitle = win.webContents.getTitle();
    addLog(`[Worker ${workerId}] URL atual: ${currentUrl} | Título: ${pageTitle}`);

    // Salva o HTML da página base carregada para diagnóstico
    try {
      const baseHtml = await win.webContents.executeJavaScript('document.documentElement.outerHTML');
      const debugBasePath = path.join(fotosDir, `debug_alunos_base_w${workerId}.html`);
      fs.writeFileSync(debugBasePath, baseHtml, 'utf-8');
      addLog(`[Worker ${workerId}] HTML base salvo em: ${debugBasePath}`);
    } catch (dumpErr) {
      addLog(`[Worker ${workerId}] Erro ao salvar HTML base: ${dumpErr.message}`, true);
    }

    // Inspeciona os elementos do formulário e funções de busca na página
    const inspectBase = await win.webContents.executeJavaScript(`
      (() => {
        try {
          const valBox = document.getElementById('ctl00_cphFormulario_tseAluno_ValueBox');
          const descBox = document.getElementById('ctl00_cphFormulario_tseAluno_DescriptionBox');
          const hasPrm = typeof Sys !== 'undefined' && Sys.WebForms && Sys.WebForms.PageRequestManager;
          const imgPessoa = document.getElementById('ctl00_cphFormulario_bimgFotoPessoa');
          const allImgs = Array.from(document.querySelectorAll('img')).map(i => ({ id: i.id, src: i.src, alt: i.alt }));

          return {
            hasValBox: !!valBox,
            valBoxAttrs: valBox ? {
              id: valBox.id,
              name: valBox.name,
              onchange: valBox.getAttribute('onchange'),
              onkeydown: valBox.getAttribute('onkeydown'),
              onblur: valBox.getAttribute('onblur')
            } : null,
            hasDescBox: !!descBox,
            hasPrm: !!hasPrm,
            hasImgPessoa: !!imgPessoa,
            totalImgs: allImgs.length,
            tsearchChangeFn: typeof tsearchTextFieldChange === 'function' ? tsearchTextFieldChange.toString().substring(0, 300) : 'undefined',
            tsearchPressFn: typeof tsearchTextFieldKeyPress === 'function' ? tsearchTextFieldKeyPress.toString().substring(0, 300) : 'undefined'
          };
        } catch (e) {
          return { error: e.message };
        }
      })();
    `);
    addLog(`[Worker ${workerId}] Diagnóstico da página: ${JSON.stringify(inspectBase)}`);

    while (queue.length > 0) {
      if (isPhotosCancelled()) {
        break;
      }

      const aluno = queue.shift();
      if (!aluno) break;

      fetchStatus.alunoAtual = `${aluno.nome} (${aluno.matricula})`;
      addLog(`[Worker ${workerId}] Buscando foto: ${aluno.nome} (${aluno.matricula}) - Turma: ${aluno.turma_nome}`);

      try {
        // Dispara a busca do aluno simulando preenchimento, eventos e tsearchTextFieldChange
        const triggerResult = await win.webContents.executeJavaScript(`
          (() => {
            try {
              const valBox = document.getElementById('ctl00_cphFormulario_tseAluno_ValueBox');
              const descBox = document.getElementById('ctl00_cphFormulario_tseAluno_DescriptionBox');
              if (!valBox) return { error: 'campo_valor_nao_encontrado' };

              if (descBox) {
                descBox.value = ''; // Limpa para detectar a mudança
              }

              valBox.focus();
              valBox.value = ${JSON.stringify(aluno.matricula)};
              valBox.setAttribute('value', ${JSON.stringify(aluno.matricula)});

              // Dispara eventos padrão
              valBox.dispatchEvent(new Event('input', { bubbles: true }));
              valBox.dispatchEvent(new Event('change', { bubbles: true }));

              // Chama explicitamente a função do Conexão Educação
              let calledTsearch = false;
              if (typeof tsearchTextFieldChange === 'function') {
                try {
                  tsearchTextFieldChange('ctl00_cphFormulario_tseAluno_st');
                  calledTsearch = true;
                } catch (tsErr) {
                  console.error('Erro ao chamar tsearchTextFieldChange:', tsErr);
                }
              }

              if (!calledTsearch && typeof valBox.onchange === 'function') {
                valBox.onchange();
              }

              // Dispara Enter
              valBox.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, which: 13, bubbles: true }));
              valBox.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', keyCode: 13, which: 13, bubbles: true }));

              valBox.dispatchEvent(new Event('blur', { bubbles: true }));

              return { success: true, calledTsearch, matricula: valBox.value };
            } catch (e) {
              return { error: e.message };
            }
          })();
        `);

        addLog(`[Worker ${workerId}] Disparo de busca para ${aluno.matricula}: ${JSON.stringify(triggerResult)}`);

        // Aguarda a resposta (postback, DOM update ou DescriptionBox preenchida)
        let alunoCarregado = false;
        let forcedPostback = false;
        let photoResult = null;
        const maxWaitMs = 15000;
        const startWait = Date.now();

        while (Date.now() - startWait < maxWaitMs) {
          await delay(600);

          // Verifica se o aluno carregou
          const checkStatus = await win.webContents.executeJavaScript(`
            (async () => {
              try {
                let inPostBack = false;
                if (typeof Sys !== 'undefined' && Sys.WebForms && Sys.WebForms.PageRequestManager) {
                  inPostBack = Sys.WebForms.PageRequestManager.getInstance().get_isInAsyncPostBack();
                }

                const descBox = document.getElementById('ctl00_cphFormulario_tseAluno_DescriptionBox');
                const descVal = descBox ? descBox.value : '';
                const img = document.getElementById('ctl00_cphFormulario_bimgFotoPessoa');
                
                // Pega a URL exata para log
                const imgSrc = img ? img.src || img.getAttribute('src') : null;

                return {
                  inPostBack,
                  descVal,
                  hasImg: !!img,
                  imgSrc
                };
              } catch (e) {
                return { error: e.message };
              }
            })();
          `);

          // Condição de sucesso: O postback não está rodando E a description box preencheu (significando que a busca retornou os dados do aluno)
          if (!checkStatus.inPostBack && checkStatus.descVal && checkStatus.descVal.trim().length > 0) {
            addLog(`[Worker ${workerId}] Aluno carregado com sucesso: "${checkStatus.descVal}"! (Imagem src: ${checkStatus.imgSrc})`);
            alunoCarregado = true;
            await delay(1000); // Aguarda um segundo adicional para garantir que a imagem tenha tempo de carregar os bytes
            break;
          }

          // Fallback após 5s: se a página não reagiu ao tsearchTextFieldChange, tenta __doPostBack direto
          if (!alunoCarregado && Date.now() - startWait >= 5000 && !forcedPostback) {
            forcedPostback = true;
            addLog(`[Worker ${workerId}] Tentando fallback com __doPostBack para ${aluno.matricula}...`);
            await win.webContents.executeJavaScript(`
              if (typeof __doPostBack === 'function') {
                __doPostBack('ctl00$cphFormulario$tseAluno', '');
              }
            `).catch(() => {});
          }
        }

        // Tenta extrair a foto
        photoResult = await win.webContents.executeJavaScript(`
          (async () => {
            try {
              let img = document.getElementById('ctl00_cphFormulario_bimgFotoPessoa');

              // Se não achou pelo ID exato, busca pelas candidatas
              if (!img) {
                const candidates = Array.from(document.querySelectorAll('img')).filter(i => 
                  (i.id && (i.id.includes('Foto') || i.id.includes('bimg'))) ||
                  (i.src && i.src.includes('DXCache'))
                );
                if (candidates.length > 0) {
                  img = candidates[0];
                }
              }

              if (!img) {
                const allCurrentImgs = Array.from(document.querySelectorAll('img')).map(i => ({ id: i.id, src: i.src, alt: i.alt }));
                return { error: 'elemento_img_nao_encontrado', debugImgs: allCurrentImgs };
              }

              const alt = (img.getAttribute('alt') || '').toLowerCase();
              const src = img.getAttribute('src') || '';

              if (!src || src === '#' || src.includes('sem_foto')) {
                return { semFoto: true, foundId: img.id, foundSrc: src, foundAlt: alt };
              }

              if (!src.includes('DXCache') && !src.includes('DXR.axd') && !src.includes('Foto') && !src.startsWith('data:') && !src.startsWith('/')) {
                return { semFoto: true, foundId: img.id, foundSrc: src, foundAlt: alt };
              }

              // Tentativa 1: Canvas
              try {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth || img.width || 150;
                canvas.height = img.naturalHeight || img.height || 150;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
                if (dataUrl && dataUrl.length > 200) {
                  return { success: true, dataUrl, foundId: img.id };
                }
              } catch (canvasErr) {}

              // Tentativa 2: Fetch
              try {
                const res = await fetch(img.src, { credentials: 'include' });
                if (!res.ok) return { error: 'fetch_status_' + res.status, foundId: img.id };
                const blob = await res.blob();
                return new Promise((resolve) => {
                  const reader = new FileReader();
                  reader.onloadend = () => resolve({ success: true, dataUrl: reader.result, foundId: img.id });
                  reader.onerror = () => resolve({ error: 'filereader_error' });
                  reader.readAsDataURL(blob);
                });
              } catch (fetchErr) {
                return { error: fetchErr.message, foundId: img.id };
              }
            } catch (e) {
              return { error: e.message };
            }
          })();
        `);

        // Se deu erro, salva o HTML e um Screenshot da janela deste momento exato
        if (photoResult.error) {
          try {
            const htmlError = await win.webContents.executeJavaScript('document.documentElement.outerHTML');
            const debugErrPath = path.join(fotosDir, `debug_aluno_${aluno.matricula}.html`);
            fs.writeFileSync(debugErrPath, htmlError, 'utf-8');

            const screenshot = await win.webContents.capturePage();
            const debugImgPath = path.join(fotosDir, `debug_aluno_${aluno.matricula}.png`);
            fs.writeFileSync(debugImgPath, screenshot.toPNG());

            addLog(`[Worker ${workerId}] HTML e Screenshot salvos em: ${debugErrPath} e ${debugImgPath}`);
          } catch (e) {}
        }

        if (photoResult.semFoto) {
          // O aluno não tem foto no SEEDUC: marca no banco e usa avatar default
          marcarAlunoSemFoto(aluno.matricula, defaultAvatarPath);
          fetchStatus.semFoto++;
          addLog(`⚪ [Sem Foto] ${aluno.nome} não possui foto no sistema. Avatar padrão aplicado. (src: ${photoResult.foundSrc}, alt: ${photoResult.foundAlt})`);
        } else if (photoResult.success && photoResult.dataUrl) {
          // Extraiu a foto com sucesso! Salva no disco
          const base64Data = photoResult.dataUrl.replace(/^data:image\/\w+;base64,/, '');
          const buffer = Buffer.from(base64Data, 'base64');
          const destFile = path.join(fotosDir, `${aluno.matricula}.jpg`);
          fs.writeFileSync(destFile, buffer);

          atualizarFotoAluno(aluno.matricula, destFile);
          fetchStatus.comFoto++;
          addLog(`📸 [Foto Salva] ${aluno.nome} (${aluno.matricula}) ✔`);
        } else {
          // Houve algum erro na extração desta foto
          fetchStatus.erros++;
          addLog(`⚠ Erro na foto de ${aluno.nome}: ${photoResult.error || 'Erro desconhecido'}`, true);
        }

      } catch (studentErr) {
        fetchStatus.erros++;
        addLog(`⚠ Falha ao processar ${aluno.nome}: ${studentErr.message}`, true);
      } finally {
        fetchStatus.processados++;
      }

      // Pequeno intervalo antes do próximo aluno
      await delay(500);
    }

  } catch (workerErr) {
    addLog(`[Worker ${workerId}] Erro crítico: ${workerErr.message}`, true);
  } finally {
    if (win) {
      try {
        win.close();
      } catch (e) {}
    }
    addLog(`[Worker ${workerId}] Finalizado.`);
  }
}

/**
 * Inicia o download de fotos dos alunos.
 * @param {Object} options
 * @param {string} [options.turma] - Turma específica ou 'TODAS'
 * @param {number} [options.concurrency=2] - Número de janelas paralelas (1 a 3)
 * @param {Array} [options.cookies] - Cookies da sessão do SEEDUC
 * @param {boolean} [options.forcar=false] - Forçar reprocessamento ignorando cache
 */
async function iniciarDownloadFotos({ turma = null, concurrency = 2, cookies = null, forcar = false } = {}) {
  if (fetchStatus.status === 'em_andamento') {
    throw new Error('Já existe um processo de download de fotos em andamento.');
  }

  // Reservar imediatamente de forma síncrona para evitar race condition com Arquivamento
  fetchStatus.status = 'em_andamento';
  cancelRequested = false;

  try {
    // Aplica cookies na sessão default se fornecidos
  if (cookies && Array.isArray(cookies)) {
    for (const cookie of cookies) {
      try {
        await session.defaultSession.cookies.set({
          url: BASE_URL,
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path || '/',
          secure: cookie.secure,
          httpOnly: cookie.httpOnly
        });
      } catch (e) {
        // Ignora erros individuais de cookie
      }
    }
  }

  // 1. Busca alunos pendentes no banco
  const turmaFiltro = (turma && turma !== 'TODAS') ? turma : null;
  const alunosPendentes = getAlunosSemFoto({ turma: turmaFiltro, forcar });

  if (alunosPendentes.length === 0) {
    fetchStatus.status = 'concluido';
    fetchStatus.mensagem = 'Todos os alunos da seleção já possuem foto ou foram verificados.';
    addLog(fetchStatus.mensagem);
    return fetchStatus;
  }

  // 2. Atualiza estado
  Object.assign(fetchStatus, {
    total: alunosPendentes.length,
    processados: 0,
    comFoto: 0,
    semFoto: 0,
    erros: 0,
    turma: turmaFiltro || 'Todas as Turmas',
    alunoAtual: null,
    mensagem: `Iniciando download de fotos (${alunosPendentes.length} alunos)...`,
    logs: []
  });

  const defaultAvatarPath = getOrCopyDefaultAvatar();
  const fotosDir = getFotosDir();

  addLog(`Fila iniciada: ${alunosPendentes.length} alunos para processar.`);
  addLog(`Turma: ${fetchStatus.turma} | Paralelismo: ${concurrency} worker(s)`);
  addLog(`Pasta de destino: ${fotosDir}`);

  const startTime = Date.now();
  
  // Cria cópia da fila para distribuição segura entre os workers
  const queue = [...alunosPendentes];

  // Ajusta concorrência (mínimo 1, máximo 3 para estabilidade da sessão)
  const numWorkers = Math.min(Math.max(1, concurrency), 3, queue.length);

  // Inicia workers em paralelo
  const workerPromises = [];
  for (let i = 1; i <= numWorkers; i++) {
    workerPromises.push(photoWorker(i, queue, defaultAvatarPath, fotosDir));
  }

  // Aguarda todos os workers terminarem
  Promise.all(workerPromises)
    .then(() => {
      const durationStr = ((Date.now() - startTime) / 1000).toFixed(1) + 's';
      if (isPhotosCancelled()) {
        fetchStatus.status = 'cancelado';
        fetchStatus.mensagem = `Processo cancelado após ${durationStr}! Processados: ${fetchStatus.processados}/${fetchStatus.total}`;
        addLog(fetchStatus.mensagem, true);
      } else {
        fetchStatus.status = 'concluido';
        fetchStatus.mensagem = `Download de fotos concluído em ${durationStr}! ${fetchStatus.comFoto} fotos baixadas, ${fetchStatus.semFoto} sem foto no sistema, ${fetchStatus.erros} erros.`;
        addLog(fetchStatus.mensagem);
      }
    })
    .catch((err) => {
      fetchStatus.status = 'erro';
      fetchStatus.mensagem = `Erro no processamento das fotos: ${err.message}`;
      addLog(fetchStatus.mensagem, true);
    });

  } catch (err) {
    fetchStatus.status = 'erro';
    fetchStatus.mensagem = `Erro de inicialização: ${err.message}`;
    return fetchStatus;
  }

  return fetchStatus;
}

module.exports = {
  iniciarDownloadFotos,
  requestCancelPhotos,
  isPhotosCancelled,
  getPhotoFetchStatus
};
