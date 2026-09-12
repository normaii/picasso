// ============================================================
// Picasso — Camada de Banco de Dados
// ============================================================
// Gerencia o SQLite: inicialização, migrações e operações
// CRUD para alunos e logs de scraping.
// ============================================================

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

/** @type {Database.Database | null} */
let db = null;

/**
 * Retorna o caminho do arquivo do banco de dados.
 * Usa DATA_DIR do .env ou fallback para ./data.
 * @returns {string}
 */
function getDbPath() {
  const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');

  // Cria o diretório se não existir
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  return path.join(dataDir, 'picasso.db');
}

/**
 * Inicializa o banco de dados e cria as tabelas se necessário.
 * @returns {Database.Database}
 */
function initDatabase() {
  if (db) return db;

  const dbPath = getDbPath();
  db = new Database(dbPath);

  // Habilita WAL mode para melhor performance
  db.pragma('journal_mode = WAL');

  // Executa o schema de criação das tabelas
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schema);

  console.log(`[DB] Banco de dados inicializado em: ${dbPath}`);
  return db;
}

/**
 * Retorna a instância do banco de dados.
 * @returns {Database.Database}
 */
function getDb() {
  if (!db) {
    return initDatabase();
  }
  return db;
}

// ============================================================
// Operações de Alunos
// ============================================================

/**
 * Insere ou atualiza um aluno no banco de dados.
 * Se a matrícula já existir, atualiza os dados.
 * @param {Object} aluno
 * @param {string} aluno.nome
 * @param {string} aluno.matricula
 * @param {string} [aluno.turma_id]
 * @param {string} [aluno.turma_nome]
 * @param {string} [aluno.foto_path]
 * @returns {Object} Resultado da operação
 */
function upsertAluno({ nome, matricula, turma_id, turma_nome, foto_path }) {
  const stmt = getDb().prepare(`
    INSERT INTO alunos (nome, matricula, turma_id, turma_nome, foto_path)
    VALUES (@nome, @matricula, @turma_id, @turma_nome, @foto_path)
    ON CONFLICT(matricula) DO UPDATE SET
      nome = @nome,
      turma_id = @turma_id,
      turma_nome = @turma_nome,
      foto_path = COALESCE(@foto_path, foto_path),
      atualizado_em = datetime('now', 'localtime')
  `);

  return stmt.run({ nome, matricula, turma_id, turma_nome, foto_path });
}

/**
 * Insere ou atualiza múltiplos alunos em uma transação.
 * @param {Array<Object>} alunos - Array de objetos aluno.
 * @returns {number} Quantidade de alunos processados.
 */
function upsertAlunosBatch(alunos) {
  const transaction = getDb().transaction((lista) => {
    for (const aluno of lista) {
      upsertAluno(aluno);
    }
    return lista.length;
  });

  return transaction(alunos);
}

/**
 * Busca alunos com filtros opcionais.
 * @param {Object} [filtros]
 * @param {string} [filtros.busca] - Busca por nome ou matrícula.
 * @param {string} [filtros.turma] - Filtra por nome da turma.
 * @param {number} [filtros.limite] - Limite de resultados.
 * @param {number} [filtros.offset] - Offset para paginação.
 * @returns {Array<Object>}
 */
function buscarAlunos({ busca, turma, limite = 100, offset = 0 } = {}) {
  let query = 'SELECT * FROM alunos WHERE 1=1';
  const params = {};

  if (busca) {
    query += ' AND (nome LIKE @busca OR matricula LIKE @busca)';
    params.busca = `%${busca}%`;
  }

  if (turma) {
    query += ' AND turma_nome = @turma';
    params.turma = turma;
  }

  query += ' ORDER BY turma_nome, nome LIMIT @limite OFFSET @offset';
  params.limite = limite;
  params.offset = offset;

  return getDb().prepare(query).all(params);
}

/**
 * Busca alunos por uma lista de IDs.
 * @param {Array<number>} ids - IDs dos alunos.
 * @returns {Array<Object>}
 */
function getAlunosPorIds(ids) {
  if (!ids || ids.length === 0) return [];

  const placeholders = ids.map(() => '?').join(', ');
  const query = `SELECT * FROM alunos WHERE id IN (${placeholders}) ORDER BY turma_nome, nome`;

  return getDb().prepare(query).all(...ids);
}

/**
 * Retorna a lista de turmas distintas.
 * @returns {Array<{turma_nome: string, total: number}>}
 */
function getTurmas() {
  return getDb().prepare(`
    SELECT turma_nome, COUNT(*) as total
    FROM alunos
    GROUP BY turma_nome
    ORDER BY turma_nome
  `).all();
}

/**
 * Retorna o total de alunos no banco.
 * @returns {number}
 */
function getTotalAlunos() {
  const result = getDb().prepare('SELECT COUNT(*) as total FROM alunos').get();
  return result.total;
}

/**
 * Atualiza o caminho da foto de um aluno.
 * @param {string} matricula
 * @param {string} fotoPath
 */
function atualizarFotoAluno(matricula, fotoPath) {
  getDb().prepare(`
    UPDATE alunos SET foto_path = ?, atualizado_em = datetime('now', 'localtime')
    WHERE matricula = ?
  `).run(fotoPath, matricula);
}

// ============================================================
// Operações de Log de Scraping
// ============================================================

/**
 * Cria um novo registro de log de scraping.
 * @returns {number} ID do log criado.
 */
function criarLogScraping() {
  const result = getDb().prepare(`
    INSERT INTO log_scraping (status) VALUES ('em_andamento')
  `).run();

  return result.lastInsertRowid;
}

/**
 * Atualiza um log de scraping existente.
 * @param {number} id - ID do log.
 * @param {Object} dados
 */
function atualizarLogScraping(id, { status, total_alunos, fotos_baixadas, erros, mensagem }) {
  getDb().prepare(`
    UPDATE log_scraping SET
      fim = CASE WHEN @status IN ('concluido', 'erro') THEN datetime('now', 'localtime') ELSE fim END,
      status = COALESCE(@status, status),
      total_alunos = COALESCE(@total_alunos, total_alunos),
      fotos_baixadas = COALESCE(@fotos_baixadas, fotos_baixadas),
      erros = COALESCE(@erros, erros),
      mensagem = COALESCE(@mensagem, mensagem)
    WHERE id = @id
  `).run({ id, status, total_alunos, fotos_baixadas, erros, mensagem });
}

/**
 * Retorna o último log de scraping.
 * @returns {Object|null}
 */
function getUltimoLogScraping() {
  return getDb().prepare(`
    SELECT * FROM log_scraping ORDER BY id DESC LIMIT 1
  `).get() || null;
}

// ============================================================
// Fecha o banco de dados
// ============================================================

/**
 * Fecha a conexão com o banco de dados.
 */
function closeDatabase() {
  if (db) {
    db.close();
    db = null;
    console.log('[DB] Conexão fechada.');
  }
}

module.exports = {
  initDatabase,
  getDb,
  closeDatabase,
  // Alunos
  upsertAluno,
  upsertAlunosBatch,
  buscarAlunos,
  getAlunosPorIds,
  getTurmas,
  getTotalAlunos,
  atualizarFotoAluno,
  // Log de Scraping
  criarLogScraping,
  atualizarLogScraping,
  getUltimoLogScraping,
};
