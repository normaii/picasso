// ============================================================
// Picasso — Preload Script
// ============================================================
// Expõe APIs seguras do Electron para o renderer process
// via contextBridge, mantendo o contextIsolation ativo.
// ============================================================

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('picasso', {
  /**
   * Abre a janela de login no Conexão Educação.
   * @returns {Promise<void>}
   */
  openLogin: () => ipcRenderer.invoke('open-login'),

  /**
   * Retorna a versão da aplicação.
   * @returns {Promise<string>}
   */
  getVersion: () => ipcRenderer.invoke('get-app-version'),

  /**
   * Registra um callback para quando o login for bem-sucedido.
   * @param {Function} callback - Recebe os cookies da sessão.
   */
  onLoginSuccess: (callback) => {
    ipcRenderer.on('login-success', (event, cookies) => callback(cookies));
  },

  /**
   * Busca a última release disponível no GitHub.
   * @returns {Promise<{version: string, url: string} | null>}
   */
  getLatestRelease: () => ipcRenderer.invoke('get-latest-release'),

  /**
   * Abre uma URL no navegador padrão do sistema operacional.
   * @param {string} url 
   */
  openExternalUrl: (url) => ipcRenderer.invoke('open-external-url', url),
});
