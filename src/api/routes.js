// ============================================================
// Picasso — Rotas da API REST
// ============================================================
// Endpoints para busca de alunos, listagem de turmas,
// geração de PDF e controle do scraping.
// ============================================================

const express = require('express');
const router = express.Router();

const {
  buscarAlunos,
  getAlunosPorIds,
  getTurmas,
  getTotalAlunos,
  getUltimoLogScraping,
} = require('../db/database');

// ============================================================
// Alunos
// ============================================================

/**
 * GET /api/alunos
 * Busca e lista alunos com filtros opcionais.
 * Query params: busca, turma, limite, offset
 */
router.get('/alunos', (req, res) => {
  try {
    const { busca, turma, limite, offset } = req.query;
    const alunos = buscarAlunos({
      busca,
      turma,
      limite: limite ? parseInt(limite) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
    const total = getTotalAlunos();

    res.json({ alunos, total });
  } catch (error) {
    console.error('[API] Erro ao buscar alunos:', error.message);
    res.status(500).json({ erro: 'Erro ao buscar alunos.' });
  }
});

/**
 * GET /api/alunos/:id
 * Retorna detalhes de um aluno específico.
 */
router.get('/alunos/:id', (req, res) => {
  try {
    const alunos = getAlunosPorIds([parseInt(req.params.id)]);
    if (alunos.length === 0) {
      return res.status(404).json({ erro: 'Aluno não encontrado.' });
    }
    res.json(alunos[0]);
  } catch (error) {
    console.error('[API] Erro ao buscar aluno:', error.message);
    res.status(500).json({ erro: 'Erro ao buscar aluno.' });
  }
});

// ============================================================
// Turmas
// ============================================================

/**
 * GET /api/turmas
 * Lista todas as turmas distintas com contagem de alunos.
 */
router.get('/turmas', (req, res) => {
  try {
    const turmas = getTurmas();
    res.json({ turmas });
  } catch (error) {
    console.error('[API] Erro ao listar turmas:', error.message);
    res.status(500).json({ erro: 'Erro ao listar turmas.' });
  }
});

// ============================================================
// Geração de PDF
// ============================================================

/**
 * POST /api/gerar
 * Gera PDF de carteirinhas para os alunos selecionados.
 * Body: { ids: [1, 2, 3] }
 */
router.post('/gerar', async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ erro: 'Envie um array de IDs de alunos.' });
    }

    const alunos = getAlunosPorIds(ids);

    if (alunos.length === 0) {
      return res.status(404).json({ erro: 'Nenhum aluno encontrado com os IDs informados.' });
    }

    // TODO: Integrar com pdfGenerator (Fase 3)
    // const pdfPath = await gerarPdf(alunos);
    // res.json({ arquivo: pdfPath, total: alunos.length });

    res.json({
      mensagem: 'Geração de PDF será implementada na Fase 3.',
      alunos_selecionados: alunos.length,
    });
  } catch (error) {
    console.error('[API] Erro ao gerar PDF:', error.message);
    res.status(500).json({ erro: 'Erro ao gerar PDF.' });
  }
});

// ============================================================
// Scraping
// ============================================================

const { iniciarScraping } = require('../scraper/scraper');

/**
 * POST /api/scraping/iniciar
 * Inicia uma operação de scraping.
 * Body: { cookies: [...] }
 */
router.post('/scraping/iniciar', async (req, res) => {
  try {
    const { cookies } = req.body;

    if (!cookies || !Array.isArray(cookies)) {
      return res.status(400).json({ erro: 'Cookies de sessão não fornecidos.' });
    }

    // Inicia de forma assíncrona para não bloquear a requisição
    iniciarScraping(cookies).catch(err => console.error(err));

    res.json({
      mensagem: 'Scraping iniciado em background. Consulte o status para acompanhar.',
    });
  } catch (error) {
    console.error('[API] Erro ao iniciar scraping:', error.message);
    res.status(500).json({ erro: 'Erro ao iniciar scraping.' });
  }
});

/**
 * GET /api/scraping/status
 * Retorna o status da última operação de scraping.
 */
router.get('/scraping/status', (req, res) => {
  try {
    const log = getUltimoLogScraping();
    res.json({ scraping: log });
  } catch (error) {
    console.error('[API] Erro ao consultar status:', error.message);
    res.status(500).json({ erro: 'Erro ao consultar status do scraping.' });
  }
});

// ============================================================
// Health Check
// ============================================================

/**
 * GET /api/health
 * Verifica se o servidor está funcionando.
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    versao: require('../../package.json').version,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
