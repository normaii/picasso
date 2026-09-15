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
    
    const resultadoScript = await win.webContents.executeJavaScript(`
      (() => {
        try {
          const alunos = [];
          
          // O sistema do Governo usa Microsoft SSRS, o relatório fica dentro de um iframe!
          const iframe = document.getElementById('ReportFramerptViewer');
          let doc = document;
          
          // Se o iframe existir e tiver conteúdo, usamos o documento dele
          if (iframe && iframe.contentDocument) {
            doc = iframe.contentDocument;
          }

          // Seletor fictício - ainda precisamos do HTML real para acertar
          const trs = doc.querySelectorAll('table tr.aluno-row'); 
          
          if (trs.length === 0) {
            return { error: 'not_found', html: doc.body.innerHTML };
          }

          trs.forEach(tr => {
            const nome = tr.querySelector('.nome')?.innerText.trim();
            const matricula = tr.querySelector('.matricula')?.innerText.trim();
            const turma_nome = tr.querySelector('.turma')?.innerText.trim();
            if (nome && matricula) {
              alunos.push({ nome, matricula, turma_nome });
            }
          });
          return { error: null, alunos: alunos };
        } catch (e) {
          return { error: 'not_found', html: "ERRO DE CÓDIGO INJETADO: " + e.message };
        }
      })();
    `);
    
    let alunosExtraidos = [];

    if (resultadoScript.error === 'not_found') {
      const debugPath = path.join(require('electron').app.getPath('userData'), 'data', 'debug_report.html');
      fs.writeFileSync(debugPath, resultadoScript.html, 'utf-8');
      console.log(\`\n=======================================================\`);
      console.log(\`[Scraper] A tabela de alunos não foi encontrada!\`);
      console.log(\`[Scraper] Eu salvei todo o HTML da página neste arquivo:\`);
      console.log(\`[Scraper] -> \${debugPath}\`);
      console.log(\`[Scraper] Por favor, abra esse arquivo, copie o código e me envie!\`);
      console.log(\`=======================================================\n\`);
    } else {
      alunosExtraidos = resultadoScript.alunos;
    }

    console.log(\`[Scraper] Encontrados \${alunosExtraidos.length} alunos.\`);
    
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
