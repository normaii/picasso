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
let dbData = { alunos: [], log_scraping: [], configuracoes: {}, _nextAlunoId: 1, _nextLogId: 1 };
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
  // Gravação atômica: grava em .tmp e substitui o original
  const tempPath = `${dbPath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(dbData, null, 2), 'utf-8');
  // Windows-safe: renameSync falha se o destino já existe (EPERM/EBUSY por
  // antivírus, Windows Search indexer, etc.). Fallback: copy + unlink.
  try {
    fs.renameSync(tempPath, dbPath);
  } catch (renameErr) {
    try {
      fs.copyFileSync(tempPath, dbPath);
      fs.unlinkSync(tempPath);
    } catch (copyErr) {
      // Propaga o erro original para que chamadores saibam que a persistência falhou
      throw renameErr;
    }
  }
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

  // Cleanup SÍNCRONO de pastas temporárias zumbis do arquivamento (PIC-3)
  // Executado antes do servidor aceitar requisições para evitar race conditions.
  const dataDir = path.dirname(dbPath);
  const fotosOficiais = path.join(dataDir, 'fotos');
  
  try {
    const items = fs.readdirSync(dataDir);
    items.forEach(item => {
      if (item.startsWith('fotos_temp_delete_')) {
        const fullPath = path.join(dataDir, item);
        const commitMarker = path.join(fullPath, '.archive_committed');
        const fotosExist = fs.existsSync(fotosOficiais);
        
        if (fs.existsSync(commitMarker)) {
          // Expurgo JÁ COMMITOU: é lixo seguro. Apagar.
          try {
            fs.rmSync(fullPath, { recursive: true, force: true });
            console.log(`[Archive Cleanup] Lixo pós-commit removido: ${item}`);
          } catch(e) {
            console.error(`[Archive Cleanup] Falha ao remover ${item}:`, e.message);
            throw e;
          }
        } else if (!fotosExist) {
          // Crash PRÉ-COMMIT: A pasta oficial sumiu e a transação não terminou. Restaurar.
          try {
            fs.renameSync(fullPath, fotosOficiais);
            console.warn(`[Archive] RECUPERAÇÃO DE EMERGÊNCIA: Fotos restauradas a partir de ${item}`);
          } catch(e) {
            console.error('[Archive] Falha ao tentar recuperar fotos da pasta zumbi:', e);
            throw e;
          }
        } else {
          // Pasta oficial existe E não há marcador de commit: lixo ambíguo, apagar com segurança.
          try {
            fs.rmSync(fullPath, { recursive: true, force: true });
            console.log(`[Archive Cleanup] Lixo zumbi removido: ${item}`);
          } catch(e) {
            console.error(`[Archive Cleanup] Falha ao remover ${item}:`, e.message);
            throw e;
          }
        }
      }
    });
  } catch(e) {
    console.error('[Archive Cleanup] Erro fatal ao varrer diretório de dados para recuperação:', e.message);
    throw e; // Impede o boot com estado incerto
  }
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
 * Retorna alunos pendentes de foto (sem foto_path e sem flag sem_foto).
 * Opcionalmente filtra por turma.
 */
function getAlunosSemFoto({ turma, forcar = false } = {}) {
  let pendentes = dbData.alunos;
  if (!forcar) {
    pendentes = pendentes.filter(a => !a.foto_path && !a.sem_foto);
  }
  if (turma && turma !== 'TODAS') {
    pendentes = pendentes.filter(a => a.turma_nome === turma);
  }
  return pendentes;
}

/**
 * Atualiza foto do aluno com o caminho salvo.
 */
function atualizarFotoAluno(matricula, fotoPath) {
  const aluno = dbData.alunos.find(a => a.matricula === matricula);
  if (aluno) {
    aluno.foto_path = fotoPath;
    aluno.sem_foto = false;
    aluno.atualizado_em = new Date().toISOString();
    saveDb();
  }
}

/**
 * Marca aluno como não possuindo foto no SEEDUC e atribui avatar padrão.
 */
function marcarAlunoSemFoto(matricula, defaultAvatarPath = null) {
  const aluno = dbData.alunos.find(a => a.matricula === matricula);
  if (aluno) {
    aluno.foto_path = defaultAvatarPath || aluno.foto_path || null;
    aluno.sem_foto = true;
    aluno.atualizado_em = new Date().toISOString();
    saveDb();
  }
}

/**
 * Retorna estatísticas sobre fotos dos alunos.
 */
function getEstatisticasFotos() {
  const total = dbData.alunos.length;
  let comFotoReal = 0;
  let semFotoOficial = 0;
  let pendentes = 0;

  for (const a of dbData.alunos) {
    if (a.sem_foto) {
      semFotoOficial++;
    } else if (a.foto_path) {
      comFotoReal++;
    } else {
      pendentes++;
    }
  }

  return {
    total,
    comFotoReal,
    semFotoOficial,
    pendentes
  };
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
    if (status === 'concluido' || status === 'erro' || status === 'cancelado') {
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

/**
 * Calcula a estimativa de tempo para a Sincronização Geral com base na última execução.
 */
function getUltimaEstimativaSincronizacao() {
  const logsConcluidos = dbData.log_scraping.filter(l => l.status === 'concluido' && l.inicio && l.fim);
  if (logsConcluidos.length === 0) {
    return { temHistorico: false, mensagem: 'Sem histórico de sincronização anterior' };
  }

  const ultimoLog = logsConcluidos[logsConcluidos.length - 1];
  const duracaoAdDMs = Math.max(0, new Date(ultimoLog.fim).getTime() - new Date(ultimoLog.inicio).getTime());

  // Estimativa do CdF baseada no total de alunos: ~3.5 segundos por aluno (com paralelismo 2)
  const totalAlunos = dbData.alunos.length || ultimoLog.total_alunos || 0;
  const duracaoCdFEstimadaMs = totalAlunos * 3500;
  const duracaoTotalMs = duracaoAdDMs + duracaoCdFEstimadaMs;
  const minutos = Math.max(1, Math.ceil(duracaoTotalMs / 60000));

  return {
    temHistorico: true,
    duracaoAdDMs,
    duracaoCdFEstimadaMs,
    duracaoTotalMs,
    minutosEstimados: minutos,
    totalAlunos,
    mensagem: `~${minutos} minuto${minutos > 1 ? 's' : ''}`
  };
}

// ============================================================
// Fecha o banco
// ============================================================

function closeDatabase() {
  saveDb();
  console.log('[DB] Conexão JSON fechada.');
}

// ============================================================
// Configurações Globais
// ============================================================

function getConfiguracoes() {
  return dbData.configuracoes || {};
}

function salvarConfiguracoes(novasConfiguracoes) {
  if (!dbData.configuracoes) {
    dbData.configuracoes = {};
  }
  
  if (novasConfiguracoes.escolaNome !== undefined) {
    dbData.configuracoes.escolaNome = novasConfiguracoes.escolaNome;
  }
  if (novasConfiguracoes.escolaLogo !== undefined) {
    dbData.configuracoes.escolaLogo = novasConfiguracoes.escolaLogo;
  }
  
  saveDb();
  return dbData.configuracoes;
}

// ============================================================
// Arquivamento e Expurgo (PIC-3)
// ============================================================

let isArchiving = false;
function getIsArchiving() { return isArchiving; }

function archiveAndPurge() {
  if (isArchiving) throw new Error('O arquivamento já está em andamento.');
  isArchiving = true;
  
  let dbDataSnapshot;
  try {
    const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // 1. Soft-Delete DB
    const archiveDbDir = path.join(dataDir, 'archive_db');
    if (!fs.existsSync(archiveDbDir)) {
      fs.mkdirSync(archiveDbDir, { recursive: true });
    }
    const currentDbPath = getDbPath();
    const archivedDbPath = path.join(archiveDbDir, `picasso_db_archived_${timestamp}.json`);
    if (fs.existsSync(currentDbPath)) {
      fs.copyFileSync(currentDbPath, archivedDbPath);
    }

    const pdfRenames = [];
    let fotosRenamed = false;
    const fotosDir = path.join(dataDir, 'fotos');
    const fotosTempDir = path.join(dataDir, `fotos_temp_delete_${timestamp}`);

    try {
      // 2. Soft-Delete PDFs (com tracking de renomeações)
      const pdfsDir = path.join(dataDir, 'pdfs');
      const archivePdfDir = path.join(pdfsDir, 'archive_pdfs');
      const newArchiveFolder = path.join(archivePdfDir, `archived_pdf_data_${timestamp}`);
      
      if (fs.existsSync(pdfsDir)) {
        if (!fs.existsSync(newArchiveFolder)) {
          fs.mkdirSync(newArchiveFolder, { recursive: true });
        }
        
        const items = fs.readdirSync(pdfsDir);
        for (const item of items) {
          if (item === 'archive_pdfs') continue;
          const oldPath = path.join(pdfsDir, item);
          const newPath = path.join(newArchiveFolder, item);
          fs.renameSync(oldPath, newPath);
          pdfRenames.push({ oldPath, newPath });
        }
      }

      // 3. Hard-Delete Fotos (preparação com rename atômico para garantir consistência)
      if (fs.existsSync(fotosDir)) {
        fs.renameSync(fotosDir, fotosTempDir);
        fotosRenamed = true;
      }

      // 4. Limpar Banco de Dados mantendo configurações globais
      dbDataSnapshot = JSON.stringify(dbData);
      dbData.alunos = [];
      dbData.log_scraping = [];
      dbData._nextAlunoId = 1;
      dbData._nextLogId = 1;
      saveDb();

      // 5. Marcar a transação como COMMITTED antes da exclusão física
      if (fotosRenamed && fs.existsSync(fotosTempDir)) {
        // Se isso falhar, o catch reverte o DB para o snapshot, restabelece as fotos e PDFs.
        fs.writeFileSync(path.join(fotosTempDir, '.archive_committed'), timestamp, 'utf-8');
      }
      
    } catch (error) {
      // === ROLLBACK COMPLETO ===
      // 1. Reverter JSON em memória e no disco
      try {
        if (typeof dbDataSnapshot !== 'undefined') {
          dbData = JSON.parse(dbDataSnapshot);
        }
      } catch (e) { console.error('Falha crítica ao restaurar snapshot em memória do DB', e); }

      if (fs.existsSync(archivedDbPath)) {
        try {
          fs.copyFileSync(archivedDbPath, currentDbPath);
        } catch (e) { console.error('Falha crítica no rollback físico do DB', e); }
      }
      // 2. Reverter fotos
      if (fotosRenamed && fs.existsSync(fotosTempDir)) {
        if (!fs.existsSync(fotosDir)) {
          try { fs.renameSync(fotosTempDir, fotosDir); } catch(e) {}
        }
      }
      // 3. Reverter PDFs com proteção contra falha em cascata
      for (const rename of pdfRenames) {
        if (fs.existsSync(rename.newPath)) {
          try { fs.renameSync(rename.newPath, rename.oldPath); } catch(e) {}
        }
      }
      throw error;
    }

    const warnings = [];

    // 6. Exclusão permanente física síncrona de todas as pastas temporárias (Crash-safe e Retry-safe)
    let hardDeleteFailed = false;
    let failedFolders = [];
    
    try {
      const items = fs.readdirSync(dataDir);
      for (const item of items) {
        if (item.startsWith('fotos_temp_delete_')) {
          const fullPath = path.join(dataDir, item);
          try {
            fs.rmSync(fullPath, { recursive: true, force: true });
          } catch (err) {
            console.error(`[Archive] Erro ao deletar pasta temp de fotos: ${item}`, err);
            hardDeleteFailed = true;
            failedFolders.push(item);
          }
        }
      }
    } catch (e) {
      console.error('[Archive] Erro ao listar diretório para limpeza final de fotos:', e);
      hardDeleteFailed = true;
      failedFolders.push('falha_ao_ler_dataDir');
    }

    if (hardDeleteFailed) {
      return {
        success: false,
        timestamp,
        erro: `O banco e os PDFs foram arquivados com sucesso, porém a exclusão física das fotos falhou para: ${failedFolders.join(', ')}. Remova manualmente para cumprir a LGPD.`,
        warnings
      };
    }

    return { success: true, timestamp, warnings };
  } finally {
    isArchiving = false;
  }
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
  getAlunosSemFoto,
  marcarAlunoSemFoto,
  getEstatisticasFotos,
  criarLogScraping,
  atualizarLogScraping,
  getUltimoLogScraping,
  getUltimaEstimativaSincronizacao,
  getConfiguracoes,
  salvarConfiguracoes,
  archiveAndPurge,
  getIsArchiving,
};
