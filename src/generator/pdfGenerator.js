const { BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { getAlunosPorTurma } = require('../db/database'); // Precisamos implementar isso se não existir, ou usar buscarAlunos

/**
 * Carrega e injeta dados nos templates
 */
function buildHtmlForStudents(alunos, escolaNome, logoUrl) {
  const a4Path = path.join(__dirname, 'templates', 'a4Layout.html');
  const cardPath = path.join(__dirname, 'templates', 'cardTemplate.html');

  const a4Content = fs.readFileSync(a4Path, 'utf-8');
  const cardContentFull = fs.readFileSync(cardPath, 'utf-8');

  // Separar CSS e HTML do cardTemplate
  const styleMatch = cardContentFull.match(/<style>([\s\S]*?)<\/style>/);
  const cardCss = styleMatch ? styleMatch[1] : '';
  const cardHtml = cardContentFull.replace(/<style>[\s\S]*?<\/style>/, '').trim();

  let allPagesHtml = '';
  
  // Agrupar alunos de 4 em 4 (uma página A4 por grupo)
  const chunkSize = 4;
  for (let i = 0; i < alunos.length; i += chunkSize) {
    const chunk = alunos.slice(i, i + chunkSize);
    
    let pageCardsHtml = '<div class="a4-page"><div class="cards-container">';
    
    for (const aluno of chunk) {
      let cardStr = cardHtml;
      
      const fotoUrl = aluno.foto_path || 'https://via.placeholder.com/150/e0e0e0/7f8c8d?text=Sem+Foto';
      const logoFinal = logoUrl || 'https://via.placeholder.com/150/ffffff/2980b9?text=LOGO';
      const ano = new Date().getFullYear();
      
      const dataStr = new Date().toLocaleDateString('pt-BR');

      cardStr = cardStr.replace(/{{ESCOLA_NOME}}/g, escolaNome);
      cardStr = cardStr.replace(/{{LOGO_URL}}/g, logoFinal);
      cardStr = cardStr.replace(/{{ANO}}/g, ano);
      cardStr = cardStr.replace(/{{FOTO_URL}}/g, fotoUrl);
      cardStr = cardStr.replace(/{{NOME}}/g, aluno.nome);
      cardStr = cardStr.replace(/{{MATRICULA}}/g, aluno.matricula);
      cardStr = cardStr.replace(/{{TURMA}}/g, aluno.turma_nome);
      cardStr = cardStr.replace(/{{DATA_EMISSAO}}/g, dataStr);

      pageCardsHtml += cardStr;
    }
    
    pageCardsHtml += '</div></div>';
    allPagesHtml += pageCardsHtml;
  }

  let finalHtml = a4Content.replace('{{CARD_CSS}}', cardCss);
  finalHtml = finalHtml.replace('{{PAGES_CONTENT}}', allPagesHtml);

  return finalHtml;
}

/**
 * Gera PDF para uma turma específica usando janela oculta do Electron
 */
async function gerarPdfTurma(turmaNome, escolaNome, logoUrl) {
  // 1. Buscar alunos
  // Vamos usar a API existente do banco de dados (buscarAlunos)
  const db = require('../db/database');
  const todos = db.buscarAlunos({ limite: 1000 });
  const alunosDaTurma = todos.filter(a => a.turma_nome === turmaNome);

  if (alunosDaTurma.length === 0) {
    throw new Error(`Nenhum aluno encontrado na turma ${turmaNome}`);
  }

  // 2. Construir HTML Completo
  const fullHtml = buildHtmlForStudents(alunosDaTurma, escolaNome, logoUrl);

  // 3. Renderizar PDF
  let win = null;
  try {
    win = new BrowserWindow({
      show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true }
    });

    const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(fullHtml);
    await win.loadURL(dataUrl);

    // Pequeno delay para garantir carregamento de imagens remotas/placeholders
    await new Promise(r => setTimeout(r, 1000));

    const pdfData = await win.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      margins: { marginType: 'none' } // Margens definidas no CSS
    });

    // 4. Salvar PDF no disco
    const baseDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
    const pdfDir = path.join(baseDir, 'pdfs');
    if (!fs.existsSync(pdfDir)) {
      fs.mkdirSync(pdfDir, { recursive: true });
    }

    const pdfPath = path.join(pdfDir, `Turma_${turmaNome}.pdf`);
    fs.writeFileSync(pdfPath, pdfData);

    console.log(`[GeradorPDF] PDF gerado com sucesso: ${pdfPath}`);
    return pdfPath;

  } catch (error) {
    console.error(`[GeradorPDF] Erro ao gerar PDF da turma ${turmaNome}:`, error);
    throw error;
  } finally {
    if (win) {
      win.close();
    }
  }
}

module.exports = {
  gerarPdfTurma
};
