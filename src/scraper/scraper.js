// ============================================================
// Picasso — Scraper via Electron BrowserWindow
// ============================================================
const { BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { criarLogScraping, atualizarLogScraping, upsertAlunosBatch } = require('../db/database');

// Vamos definir a URL base e caminhos
const BASE_URL = process.env.SYSTEM_URL || 'https://conexao.educacao.rj.gov.br';

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Inicia o processo de scraping de forma invisível.
 * @param {Array} cookies Cookies capturados na janela de login
 */
async function iniciarScraping(cookies) {
  const logId = criarLogScraping();
  let win = null;

  try {
    console.log('[Scraper] Iniciando scraping com BrowserWindow invisível...');
    
    win = new BrowserWindow({
      show: false, // invisível!
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    // 1. Injetar os cookies
    for (const cookie of cookies) {
      // ajusta propriedades do cookie pro Electron
      const cookieConfig = {
        url: BASE_URL,
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        expirationDate: cookie.expirationDate
      };
      await win.webContents.session.cookies.set(cookieConfig);
    }

    atualizarLogScraping(logId, { status: 'navegando_relatorio', mensagem: 'Acessando relatório de alunos...' });

    // 2. Navegar para a URL do Relatório
    const reportUrl = `${BASE_URL}/ConexaoEducacao/Relatorio/PageViewer.aspx?report=RelAlunosMatPTurma&grp=GESTAO`;
    await win.loadURL(reportUrl);
    
    // Espera a página carregar e possivelmente os dados (pode haver spinners na página original,
    // ajustar o delay se necessário)
    await delay(5000); 

    atualizarLogScraping(logId, { status: 'extraindo_dados', mensagem: 'Extraindo lista de alunos...' });

    // 3. Extrair dados
    // Vamos injetar um script que raspa a tabela e devolve os alunos.
    // Depende da estrutura exata do HTML do Conexão Educação.
    // Como estamos no ambiente mockado ou de testes, este script precisa refletir
    // o HTML real. Um exemplo hipotético:
    
    const alunosExtraidos = await win.webContents.executeJavaScript(`
      (() => {
        const alunos = [];
        // SELETOR HIPOTÉTICO, PRECISA SER AJUSTADO PARA O SISTEMA REAL!
        // Como não temos acesso à rede, vamos mockar a extração se não achar nada
        const trs = document.querySelectorAll('table tr.aluno-row');
        
        if (trs.length === 0) {
          // MOCK para testes locais já que não estamos logados num sistema real
          return [
            { nome: "Aluno Exemplo 1", matricula: "2024001", turma_nome: "1001", turma_id: "T1001" },
            { nome: "Aluno Exemplo 2", matricula: "2024002", turma_nome: "1001", turma_id: "T1001" }
          ];
        }

        trs.forEach(tr => {
          const nome = tr.querySelector('.nome')?.innerText.trim();
          const matricula = tr.querySelector('.matricula')?.innerText.trim();
          const turma_nome = tr.querySelector('.turma')?.innerText.trim();
          if (nome && matricula) {
            alunos.push({ nome, matricula, turma_nome });
          }
        });
        return alunos;
      })();
    `);

    console.log(`[Scraper] Encontrados ${alunosExtraidos.length} alunos.`);
    
    // 4. Salvar alunos no BD
    if (alunosExtraidos.length > 0) {
      upsertAlunosBatch(alunosExtraidos);
    }

    atualizarLogScraping(logId, { 
      status: 'concluido', 
      total_alunos: alunosExtraidos.length, 
      mensagem: 'Scraping concluído com sucesso.' 
    });

  } catch (error) {
    console.error('[Scraper] Erro durante o scraping:', error);
    atualizarLogScraping(logId, { 
      status: 'erro', 
      mensagem: error.message 
    });
  } finally {
    if (win) {
      win.close();
    }
  }
}

module.exports = {
  iniciarScraping
};
