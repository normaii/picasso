// ============================================================
// Picasso — Camada de Banco de Dados (JSON Local)
// ============================================================
// Gerencia os dados usando um arquivo JSON puro.
// Elimina dependências nativas (C++) para evitar problemas
// de instalação em computadores de escolas.
// ============================================================

const fs = require('fs');
const path = require('path');
require('dotenv').config();

let dbPath = '';
let dbData = { alunos: [], log_scraping: [], _nextAlunoId: 1, _nextLogId: 1 };
let dbInitialized = false;

/**
 * Retorna o caminho do arquivo do banco de dados.
 * Usa DATA_DIR do .env ou fallback para ./data.
 * @returns {string}
 */
function getDbPath() {
  const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return path.join(dataDir, 'picasso_db.json');
}

/**
 * Salva o banco de dados atual no arquivo.
 */
function saveDb() {
  if (!dbPath) return;
  // Escreve de forma síncrona
  fs.writeFileSync(dbPath, JSON.stringify(dbData, null, 2), 'utf-8');
}

/**
 * Inicializa o banco de dados.
 */
function initDatabase() {
  if (dbInitialized) return;
  dbPath = getDbPath();
  
  if (fs.existsSync(dbPath)) {
    try {
      const content = fs.readFileSync(dbPath, 'utf-8');
      dbData = JSON.parse(content);
    } catch (err) {
      console.error('[DB] Erro ao ler JSON. Recriando banco de dados.', err);
      saveDb(); // Substitui arquivo quebrado
    }
  } else {
    saveDb();
  }
  
  dbInitialized = true;
  console.log(`[DB] Banco de dados JSON inicializado em: ${dbPath}`);
}

// ============================================================
// Operações de Alunos
// ============================================================

/**
 * Insere ou atualiza um aluno.
 */
function upsertAluno({ nome, matricula, turma_id, turma_nome, foto_path }) {
  const now = new Date().toISOString();
  let aluno = dbData.alunos.find(a => a.matricula === matricula);

  if (aluno) {
    aluno.nome = nome;
    if (turma_id) aluno.turma_id = turma_id;
    if (turma_nome) aluno.turma_nome = turma_nome;
    if (foto_path) aluno.foto_path = foto_path;
    aluno.atualizado_em = now;
  } else {
    aluno = {
      id: dbData._nextAlunoId++,
      nome,
      matricula,
      turma_id: turma_id || null,
      turma_nome: turma_nome || null,
      foto_path: foto_path || null,
      data_scraping: now,
      atualizado_em: now
    };
    dbData.alunos.push(aluno);
  }
  
  saveDb();
  return aluno;
}

/**
 * Insere ou atualiza múltiplos alunos.
 */
function upsertAlunosBatch(alunos) {
  for (const aluno of alunos) {
    upsertAluno(aluno); // saveDb is called inside, it might be slow for huge batches, but fine for 1000-2000.
    // We could optimize this by pausing saveDb and calling it once at the end, 
    // but let's keep it simple for now.
  }
  return alunos.length;
}

/**
 * Busca alunos com filtros.
 */
function buscarAlunos({ busca, turma, limite = 100, offset = 0 } = {}) {
  let filtrados = dbData.alunos;

  if (busca) {
    const buscaLower = busca.toLowerCase();
    filtrados = filtrados.filter(a => 
      a.nome.toLowerCase().includes(buscaLower) || 
      a.matricula.includes(busca)
    );
  }

  if (turma) {
    filtrados = filtrados.filter(a => a.turma_nome === turma);
  }

  // Ordenar por turma, depois nome
  filtrados.sort((a, b) => {
    const turmaA = a.turma_nome || '';
    const turmaB = b.turma_nome || '';
    if (turmaA < turmaB) return -1;
    if (turmaA > turmaB) return 1;
    const nomeA = a.nome || '';
    const nomeB = b.nome || '';
    if (nomeA < nomeB) return -1;
    if (nomeA > nomeB) return 1;
    return 0;
  });

  return filtrados.slice(offset, offset + limite);
}

/**
 * Busca alunos por IDs.
 */
function getAlunosPorIds(ids) {
  if (!ids || ids.length === 0) return [];
  return dbData.alunos.filter(a => ids.includes(a.id));
}

/**
 * Retorna lista de turmas.
 */
function getTurmas() {
  const contagem = {};
  for (const a of dbData.alunos) {
    if (a.turma_nome) {
      contagem[a.turma_nome] = (contagem[a.turma_nome] || 0) + 1;
    }
  }
  const turmas = Object.keys(contagem).map(turma_nome => ({
    turma_nome,
    total: contagem[turma_nome]
  }));
  turmas.sort((a, b) => a.turma_nome.localeCompare(b.turma_nome));
  return turmas;
}

/**
 * Retorna o total de alunos.
 */
function getTotalAlunos() {
  return dbData.alunos.length;
}

/**
 * Atualiza foto do aluno.
 */
function atualizarFotoAluno(matricula, fotoPath) {
  const aluno = dbData.alunos.find(a => a.matricula === matricula);
  if (aluno) {
    aluno.foto_path = fotoPath;
    aluno.atualizado_em = new Date().toISOString();
    saveDb();
  }
}

// ============================================================
// Operações de Log de Scraping
// ============================================================

function criarLogScraping() {
  const log = {
    id: dbData._nextLogId++,
    inicio: new Date().toISOString(),
    fim: null,
    status: 'em_andamento',
    total_alunos: 0,
    fotos_baixadas: 0,
    erros: 0,
    mensagem: null
  };
  dbData.log_scraping.push(log);
  saveDb();
  return log.id;
}

function atualizarLogScraping(id, { status, total_alunos, fotos_baixadas, erros, mensagem }) {
  const log = dbData.log_scraping.find(l => l.id === id);
  if (log) {
    if (status === 'concluido' || status === 'erro') {
      log.fim = new Date().toISOString();
    }
    if (status !== undefined) log.status = status;
    if (total_alunos !== undefined) log.total_alunos = total_alunos;
    if (fotos_baixadas !== undefined) log.fotos_baixadas = fotos_baixadas;
    if (erros !== undefined) log.erros = erros;
    if (mensagem !== undefined) log.mensagem = mensagem;
    saveDb();
  }
}

function getUltimoLogScraping() {
  if (dbData.log_scraping.length === 0) return null;
  return dbData.log_scraping[dbData.log_scraping.length - 1];
}

// ============================================================
// Fecha o banco
// ============================================================

function closeDatabase() {
  saveDb();
  console.log('[DB] Conexão JSON fechada.');
}

module.exports = {
  initDatabase,
  closeDatabase,
  upsertAluno,
  upsertAlunosBatch,
  buscarAlunos,
  getAlunosPorIds,
  getTurmas,
  getTotalAlunos,
  atualizarFotoAluno,
  criarLogScraping,
  atualizarLogScraping,
  getUltimoLogScraping,
};
