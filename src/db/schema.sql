-- ============================================================
-- Picasso — Schema do Banco de Dados
-- ============================================================
-- Tabelas para armazenar dados dos alunos e logs de scraping.
-- Banco: SQLite (arquivo único na pasta de dados).
-- ============================================================

-- Tabela de alunos
CREATE TABLE IF NOT EXISTS alunos (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    nome            TEXT    NOT NULL,
    matricula       TEXT    NOT NULL UNIQUE,
    turma_id        TEXT,
    turma_nome      TEXT,
    foto_path       TEXT,
    data_scraping   TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    atualizado_em   TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Índices para buscas rápidas
CREATE INDEX IF NOT EXISTS idx_alunos_matricula  ON alunos(matricula);
CREATE INDEX IF NOT EXISTS idx_alunos_turma      ON alunos(turma_nome);
CREATE INDEX IF NOT EXISTS idx_alunos_nome       ON alunos(nome);

-- Tabela de log de scraping
CREATE TABLE IF NOT EXISTS log_scraping (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    inicio          TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    fim             TEXT,
    status          TEXT    NOT NULL DEFAULT 'em_andamento',
    total_alunos    INTEGER DEFAULT 0,
    fotos_baixadas  INTEGER DEFAULT 0,
    erros           INTEGER DEFAULT 0,
    mensagem        TEXT
);
