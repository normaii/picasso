const { BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { getAlunosPorTurma } = require('../db/database'); // Precisamos implementar isso se não existir, ou usar buscarAlunos
const { escapeHtml } = require('../utils/security');

/**
 * Resolve a imagem do aluno para data URI (base64) para renderização garantida no PDF.
 * Usa o avatar padrão local como fallback caso não haja foto.
 */
function resolveFotoDataUrl(fotoPath) {
  if (fotoPath && fs.existsSync(fotoPath)) {
    try {
      const ext = path.extname(fotoPath).toLowerCase().slice(1) || 'jpeg';
      const b64 = fs.readFileSync(fotoPath).toString('base64');
      return `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${b64}`;
    } catch (e) {
      console.error('[PDF] Erro ao ler foto do aluno:', e.message);
    }
  }

  const candidateAvatars = [
    path.join(__dirname, '..', '..', 'assets', 'default_avatar.jpg'),
    path.join(__dirname, '..', '..', 'public', 'assets', 'default_avatar.jpg')
  ];

  for (const avatarPath of candidateAvatars) {
    if (fs.existsSync(avatarPath)) {
      try {
        const b64 = fs.readFileSync(avatarPath).toString('base64');
        return `data:image/jpeg;base64,${b64}`;
      } catch (e) {}
    }
  }
  return 'https://placehold.co/150x150/e0e0e0/7f8c8d.png?text=Sem+Foto';
}

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
      
      const fotoUrl = resolveFotoDataUrl(aluno.foto_path);
      const logoFinal = logoUrl || 'https://placehold.co/150x150/ffffff/2980b9.png?text=LOGO';
      const ano = new Date().getFullYear();
      
      const dataStr = new Date().toLocaleDateString('pt-BR');

      cardStr = cardStr.replace(/{{ESCOLA_NOME}}/g, () => escapeHtml(escolaNome));
      cardStr = cardStr.replace(/{{LOGO_URL}}/g, () => escapeHtml(logoFinal));
      cardStr = cardStr.replace(/{{ANO}}/g, () => ano);
      cardStr = cardStr.replace(/{{FOTO_URL}}/g, () => fotoUrl);
      cardStr = cardStr.replace(/{{NOME}}/g, () => escapeHtml(aluno.nome));
      cardStr = cardStr.replace(/{{MATRICULA}}/g, () => escapeHtml(aluno.matricula));
      cardStr = cardStr.replace(/{{TURMA}}/g, () => escapeHtml(aluno.turma_nome));
      cardStr = cardStr.replace(/{{DATA_EMISSAO}}/g, () => escapeHtml(dataStr));

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
  let tmpHtmlPath = null;
  try {
    win = new BrowserWindow({
      show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true }
    });

    const baseDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
    const pdfDir = path.join(baseDir, 'pdfs');
    if (!fs.existsSync(pdfDir)) {
      fs.mkdirSync(pdfDir, { recursive: true });
    }

    // Salva o HTML em um arquivo temporário para evitar limites de tamanho de URL (ERR_INVALID_URL)
    tmpHtmlPath = path.join(pdfDir, `temp_${turmaNome}_${Date.now()}.html`);
    fs.writeFileSync(tmpHtmlPath, fullHtml, 'utf-8');

    await win.loadFile(tmpHtmlPath);

    // Pequeno delay para garantir carregamento de imagens remotas/placeholders
    await new Promise(r => setTimeout(r, 1000));

    const pdfData = await win.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      margins: { marginType: 'none' } // Margens definidas no CSS
    });

    // 4. Salvar PDF no disco
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
    if (tmpHtmlPath && fs.existsSync(tmpHtmlPath)) {
      try { fs.unlinkSync(tmpHtmlPath); } catch(e) {}
    }
  }
}

module.exports = {
  gerarPdfTurma
};
