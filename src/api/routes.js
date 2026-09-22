// ============================================================
// Picasso — Rotas da API REST
// ============================================================
// Endpoints para busca de alunos, listagem de turmas,
// geração de PDF e controle do scraping.
// ============================================================

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const {
  buscarAlunos,
  getAlunosPorIds,
  getTurmas,
  getTotalAlunos,
  getUltimoLogScraping,
  getEstatisticasFotos,
  getUltimaEstimativaSincronizacao,
  getConfiguracoes,
  salvarConfiguracoes,
} = require('../db/database');

const {
  iniciarDownloadFotos,
  requestCancelPhotos,
  getPhotoFetchStatus,
} = require('../scraper/photoFetcher');

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
    const turmasObj = getTurmas();
    const turmasNomes = turmasObj.map(t => t.turma_nome);
    res.json({ turmas: turmasNomes, detalhes: turmasObj });
  } catch (error) {
    console.error('[API] Erro ao listar turmas:', error.message);
    res.status(500).json({ erro: 'Erro ao listar turmas.' });
  }
});

// ============================================================
// Configurações Globais
// ============================================================

/**
 * GET /api/config
 * Retorna as configurações globais da aplicação.
 */
router.get('/config', (req, res) => {
  try {
    const config = getConfiguracoes();
    res.json(config);
  } catch (error) {
    console.error('[API] Erro ao buscar configurações:', error.message);
    res.status(500).json({ erro: 'Erro ao buscar configurações.' });
  }
});

/**
 * POST /api/config
 * Atualiza as configurações globais da aplicação.
 */
router.post('/config', (req, res) => {
  try {
    const novasConfiguracoes = req.body;
    const atualizadas = salvarConfiguracoes(novasConfiguracoes);
    res.json({ mensagem: 'Configurações salvas com sucesso.', configuracoes: atualizadas });
  } catch (error) {
    console.error('[API] Erro ao salvar configurações:', error.message);
    res.status(500).json({ erro: 'Erro ao salvar configurações.' });
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

const { iniciarScraping, requestCancel } = require('../scraper/scraper');

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
 * POST /api/scraping/cancelar
 * Cancela a operação de scraping em andamento.
 */
router.post('/scraping/cancelar', (req, res) => {
  try {
    requestCancel();
    res.json({ mensagem: 'Cancelamento solicitado.' });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao cancelar.' });
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

/**
 * GET /api/sincronizacao/estimativa
 * Retorna se há histórico prévio e o tempo estimado da Sincronização Geral.
 */
router.get('/sincronizacao/estimativa', (req, res) => {
  try {
    const estimativa = getUltimaEstimativaSincronizacao();
    res.json(estimativa);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao obter estimativa de sincronização.' });
  }
});

// ============================================================
// Fotos dos Alunos (photoFetcher)
// ============================================================

/**
 * POST /api/fotos/iniciar
 * Inicia download de fotos em background com suporte a concorrência e filtro por turma.
 * Body: { turma?: string, concurrency?: number, cookies?: Array }
 */
router.post('/fotos/iniciar', async (req, res) => {
  try {
    const { turma, concurrency, cookies, forcar } = req.body || {};

    // Dispara em background
    iniciarDownloadFotos({ turma, concurrency, cookies, forcar }).catch(err => {
      console.error('[API] Erro em background ao baixar fotos:', err.message);
    });

    res.json({
      mensagem: 'Download de fotos iniciado em background.',
      turma: turma || 'Todas as turmas'
    });
  } catch (error) {
    console.error('[API] Erro ao iniciar download de fotos:', error.message);
    res.status(400).json({ erro: error.message });
  }
});

/**
 * POST /api/fotos/cancelar
 * Cancela o download de fotos em andamento.
 */
router.post('/fotos/cancelar', (req, res) => {
  try {
    requestCancelPhotos();
    res.json({ mensagem: 'Solicitação de cancelamento de fotos enviada.' });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao cancelar download de fotos.' });
  }
});

/**
 * GET /api/fotos/status
 * Retorna status em tempo real do download de fotos e estatísticas.
 */
router.get('/fotos/status', (req, res) => {
  try {
    const status = getPhotoFetchStatus();
    res.json({ fotos: status });
  } catch (error) {
    console.error('[API] Erro ao consultar status das fotos:', error.message);
    res.status(500).json({ erro: 'Erro ao consultar status das fotos.' });
  }
});

/**
 * GET /api/fotos/estatisticas
 * Retorna estatísticas de fotos (com foto, sem foto no sistema, pendentes).
 */
router.get('/fotos/estatisticas', (req, res) => {
  try {
    const stats = getEstatisticasFotos();
    res.json({ estatisticas: stats });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao consultar estatísticas de fotos.' });
  }
});

/**
 * GET /api/fotos/arquivo/:matricula
 * Serve o arquivo de foto do aluno ou avatar padrão se não houver.
 */
router.get('/fotos/arquivo/:matricula', (req, res) => {
  try {
    const { matricula } = req.params;
    const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
    const fotoPath = path.join(dataDir, 'fotos', `${matricula}.jpg`);

    if (fs.existsSync(fotoPath)) {
      return res.sendFile(fotoPath);
    }

    const defaultAvatar = path.join(__dirname, '..', '..', 'assets', 'default_avatar.jpg');
    if (fs.existsSync(defaultAvatar)) {
      return res.sendFile(defaultAvatar);
    }

    res.status(404).send('Foto não encontrada.');
  } catch (error) {
    console.error('[API] Erro ao servir foto:', error);
    res.status(500).json({ erro: 'Erro ao servir foto.' });
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

// ============================================================
// Geração de PDF (Fase 3)
// ============================================================

const { gerarPdfTurma } = require('../generator/pdfGenerator');

// Mantém um log simples em memória para o progresso do PDF (para fins de demonstração)
let pdfStatus = { status: 'ocioso', ultimaTurma: null, arquivo: null, erro: null };

/**
 * POST /api/pdf/gerar
 * Inicia a geração de PDF para uma turma
 * Body: { turma: '9A', escolaNome: 'Colégio Estadual', logoUrl: '...' }
 */
router.post('/pdf/gerar', async (req, res) => {
  try {
    const { turma } = req.body;
    if (!turma) {
      return res.status(400).json({ erro: 'O nome da turma é obrigatório.' });
    }

    const config = getConfiguracoes();
    const escolaNome = config.escolaNome || 'ESCOLA ESTADUAL';
    const logoUrl = config.escolaLogo || '';

    pdfStatus = { status: 'processando', ultimaTurma: turma, arquivo: null, erro: null };

    // Inicia de forma assíncrona
    gerarPdfTurma(turma, escolaNome, logoUrl)
      .then(caminho => {
        pdfStatus = { status: 'concluido', ultimaTurma: turma, arquivo: caminho, erro: null };
      })
      .catch(err => {
        pdfStatus = { status: 'erro', ultimaTurma: turma, arquivo: null, erro: err.message };
      });

    res.json({ mensagem: `Geração de PDF para a turma ${turma} iniciada em background.` });
  } catch (error) {
    console.error('[API] Erro ao iniciar geração de PDF:', error);
    res.status(500).json({ erro: 'Erro interno.' });
  }
});

/**
 * GET /api/pdf/status
 * Retorna o status da geração de PDF
 */
router.get('/pdf/status', (req, res) => {
  res.json({ status: pdfStatus });
});

module.exports = router;
