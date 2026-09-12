// ============================================================
// Picasso — Servidor Express Embutido
// ============================================================
// Servidor HTTP local que serve a interface e disponibiliza
// os endpoints da API REST para scraping, consulta e geração.
// ============================================================

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { initDatabase } = require('./src/db/database');
const apiRoutes = require('./src/api/routes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve arquivos estáticos (front-end)
app.use(express.static(path.join(__dirname, 'public')));

// Monta rotas da API
app.use('/api', apiRoutes);

// Fallback — serve index.html para rotas não encontradas (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/**
 * Inicia o servidor Express na porta especificada.
 * @param {number} port - Porta para o servidor.
 * @returns {Promise<void>}
 */
async function startServer(port) {
  // Inicializa o banco de dados (cria tabelas se não existirem)
  initDatabase();

  return new Promise((resolve) => {
    app.listen(port, () => {
      console.log(`[Express] Servidor iniciado na porta ${port}`);
      resolve();
    });
  });
}

module.exports = { startServer, app };
