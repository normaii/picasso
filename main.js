// ============================================================
// Picasso — Entry Point do Electron
// ============================================================
// Gerencia a janela principal da aplicação e a janela de login
// para o Conexão Educação (login manual com CAPTCHA).
// ============================================================

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Carrega variáveis de ambiente
require('dotenv').config();

// Importa e inicia o servidor Express embutido
const { startServer } = require('./server');

/** @type {BrowserWindow | null} */
let mainWindow = null;

/** @type {BrowserWindow | null} */
let loginWindow = null;

const PORT = process.env.PORT || 3000;

/**
 * Cria a janela principal da aplicação.
 */
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Picasso — Carteirinhas Escolares',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'src', 'preload.js'),
    },
  });

  // Carrega a interface servida pelo Express
  mainWindow.loadURL(`http://localhost:${PORT}`);

  // Abre DevTools automaticamente em modo de desenvolvimento
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * Abre a janela de login no Conexão Educação.
 * O diretor faz login manualmente (com CAPTCHA), e os cookies
 * da sessão são capturados após o login bem-sucedido.
 */
function openLoginWindow() {
  const systemUrl = process.env.SYSTEM_URL || 'https://conexao.educacao.rj.gov.br';

  loginWindow = new BrowserWindow({
    width: 1024,
    height: 700,
    title: 'Login — Conexão Educação',
    parent: mainWindow,
    modal: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  loginWindow.loadURL(systemUrl);

  // Monitora navegação para detectar login bem-sucedido
  loginWindow.webContents.on('did-navigate', async (event, url) => {
    const lowerUrl = url.toLowerCase();
    const isRootOrBase = lowerUrl === systemUrl.toLowerCase() || 
                         lowerUrl === systemUrl.toLowerCase() + '/' ||
                         lowerUrl.endsWith('/conexaoeducacao') || 
                         lowerUrl.endsWith('/conexaoeducacao/');
    const isLogin = lowerUrl.includes('login');

    // Após login, a URL muda para a página principal do sistema (não é raiz e não é login)
    if (lowerUrl.includes('/conexaoeducacao/') && !isLogin && !isRootOrBase) {
      // Captura os cookies da sessão
      const cookies = await loginWindow.webContents.session.cookies.get({
        domain: '.educacao.rj.gov.br',
      });

      // Se não pegou nenhum cookie, talvez a navegação ainda não tenha setado.
      // Mas assumiremos que navegou pra dentro do sistema, então logou.
      mainWindow.webContents.send('login-success', cookies);

      // Fecha a janela de login
      loginWindow.close();
    }
  });

  loginWindow.on('closed', () => {
    loginWindow = null;
  });
}

// ============================================================
// ============================================================
// Ciclo de Vida do Electron
// ============================================================

// Garante que apenas uma instância do aplicativo esteja rodando (ADR-015)
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  console.log('[Picasso] Uma instância já está em execução. Fechando esta...');
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Alguém tentou abrir uma segunda instância, vamos focar na nossa janela principal
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    // Configura o diretório de dados para o AppData seguro do sistema e passa pro Express via ENV
    const userDataPath = app.getPath('userData');
    const dataDir = path.join(userDataPath, 'data');
    process.env.DATA_DIR = dataDir;
    
    // Inicia o servidor Express antes de criar a janela
    await startServer(PORT);
    console.log(`[Picasso] Servidor rodando em http://localhost:${PORT}`);
    console.log(`[Picasso] Dados salvos em: ${dataDir}`);

    createMainWindow();
  });

  // Fecha a aplicação quando todas as janelas forem fechadas (Windows/Linux)
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  // macOS: recria janela ao clicar no ícone do dock
  app.on('activate', () => {
    if (mainWindow === null) {
      createMainWindow();
    }
  });
}

// ============================================================
// IPC — Comunicação entre renderer e main process
// ============================================================

ipcMain.handle('open-login', () => {
  openLoginWindow();
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-latest-release', async () => {
  try {
    const res = await fetch('https://api.github.com/repos/normaii/picasso/releases/latest', {
      headers: { 'User-Agent': 'Picasso-App' }
    });
    if (!res.ok) throw new Error('Falha ao buscar release');
    const data = await res.json();
    return {
      version: data.tag_name, // Ex: "v0.0.4"
      url: data.html_url
    };
  } catch (err) {
    console.error('[Picasso] Erro ao buscar atualizações:', err);
    return null;
  }
});

ipcMain.handle('open-external-url', (event, url) => {
  const { shell } = require('electron');
  shell.openExternal(url);
});
