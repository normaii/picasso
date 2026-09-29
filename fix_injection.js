const fs = require('fs');
let content = fs.readFileSync('src/scraper/scraper.js', 'utf-8');

// Replace semester injection
content = content.replace(
  "el.value = '${currentSemestre.val}';",
  "el.value = ${JSON.stringify(currentSemestre.val)};"
);

// Replace turma val injection
content = content.replace(
  "document.getElementById('rptViewer_ctl00_ctl13_ddValue').value = '${currentTurma.val}';",
  "document.getElementById('rptViewer_ctl00_ctl13_ddValue').value = ${JSON.stringify(currentTurma.val)};"
);

// Replace markerKey
content = content.replace(
  "const markerKey = '${currentSemestre ? currentSemestre.val + \":\" : \"\"}${currentTurma.val}';",
  "const markerKey = ${JSON.stringify((currentSemestre ? currentSemestre.val + ':' : '') + currentTurma.val)};"
);

// Replace markerKey2
content = content.replace(
  "const markerKey2 = '${currentSemestre ? currentSemestre.val + \":\" : \"\"}${currentTurma.val}';",
  "const markerKey2 = ${JSON.stringify((currentSemestre ? currentSemestre.val + ':' : '') + currentTurma.val)};"
);

content = content.replace(
  "const markerKey2 = '${currentSemestre ? currentSemestre.val + \\':\\' : \\'\\'}${currentTurma.val}';",
  "const markerKey2 = ${JSON.stringify((currentSemestre ? currentSemestre.val + ':' : '') + currentTurma.val)};"
);

// Replace turma text in extraction
content = content.replace(
  "alunos.push({ nome, matricula, turma_nome: '${currentTurma.text}' });",
  "alunos.push({ nome, matricula, turma_nome: ${JSON.stringify(currentTurma.text)} });"
);

fs.writeFileSync('src/scraper/scraper.js', content);
