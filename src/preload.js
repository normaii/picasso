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
});
