const { app } = require('electron');
const { gerarPdfTurma } = require('./src/generator/pdfGenerator');
const { initDatabase, upsertAluno } = require('./src/db/database');

app.whenReady().then(async () => {
  try {
    initDatabase();
    // Inserir alunos fictícios
    upsertAluno({ nome: 'João da Silva', matricula: '2024001', turma_nome: '1001' });
    upsertAluno({ nome: 'Maria Santos', matricula: '2024002', turma_nome: '1001' });
    upsertAluno({ nome: 'José Pedro', matricula: '2024003', turma_nome: '1001' });
    upsertAluno({ nome: 'Ana Paula', matricula: '2024004', turma_nome: '1001' });
    upsertAluno({ nome: 'Carlos Souza', matricula: '2024005', turma_nome: '1001' });

    console.log('Iniciando geração de PDF para 1001...');
    const pdfPath = await gerarPdfTurma('1001', 'C.E. Rio de Janeiro', '');
    console.log('Sucesso! Salvo em:', pdfPath);
    app.exit(0);
  } catch (error) {
    console.error('Erro no teste:', error);
    app.exit(1);
  }
});
