const fs = require('fs');
let content = fs.readFileSync('src/scraper/scraper.js', 'utf-8');

// 1. Electron errors
content = content.replace(
  "err.message.includes('Execution context was destroyed') || err.message.includes('Inspected target navigated')",
  "err.message.includes('Execution context was destroyed') || err.message.includes('Inspected target navigated') || err.message.includes('Script failed to execute') || err.message.includes('this world has been destroyed')"
);

// 2. Stop clearing innerHTML
content = content.replace(
  "f.contentDocument.body.innerHTML = '';",
  "// f.contentDocument.body.innerHTML = ''; // Removido: preserva iframe para evitar timeout do SSRS viewer"
);

// 3. timeoutTimer returns html
content = content.replace(
  "                  finish({ error: 'table_not_found' });\r\n               } else {\r\n                  finish({ error: 'iframe_not_found_timeout' });",
  "                  finish({ error: 'table_not_found', html: document.documentElement.outerHTML });\n               } else {\n                  finish({ error: 'iframe_not_found_timeout', html: document.documentElement.outerHTML });"
);

// 4. tryExtract observer logic
const tryExtractOld = `                try {
                  const subFrame = doc.getElementById('report');
                  if (subFrame) {
                     // Se existe o frame aninhado mas ele ainda não tem documento, aguarda!
                     if (!subFrame.contentDocument || !subFrame.contentDocument.body) return;
                     doc = subFrame.contentDocument;
                  }
                } catch(e) { }

                // Agora doc aponta para o documento final (nested ou outer)
                // Checa a marcação: se já foi scraped para ESTE semestre+turma, ignora
                const markerKey = \`\${currentSemestre ? currentSemestre.val + ':' : ''}\${currentTurma.val}\`;
                const scrapedVal = doc.body.getAttribute('data-scraped-turma');
                if (scrapedVal === markerKey) return;

                if (!iframeObserver || iframeObserver.doc !== doc) {`;

const tryExtractNew = `                try {
                  const subFrame = doc.getElementById('report');
                  if (subFrame) {
                     if (!subFrame.hasAttribute('data-load-listener-attached')) {
                        subFrame.setAttribute('data-load-listener-attached', 'true');
                        subFrame.addEventListener('load', tryExtract);
                     }
                     // Se existe o frame aninhado mas ele ainda não tem documento, aguarda!
                     if (!subFrame.contentDocument || !subFrame.contentDocument.body) return;
                     doc = subFrame.contentDocument;
                  }
                } catch(e) { }

                // Agora doc aponta para o documento final (nested ou outer)
                // Checa a marcação: se já foi scraped para ESTE semestre+turma, ignora
                const markerKey = \`\${currentSemestre ? currentSemestre.val + ':' : ''}\${currentTurma.val}\`;
                const scrapedVal = doc.body.getAttribute('data-scraped-turma');
                if (scrapedVal === markerKey) return;
                if (scrapedVal === 'INVALIDATING') return;

                if (!iframeObserver || iframeObserver.doc !== doc) {`;
content = content.split(tryExtractOld).join(tryExtractNew);

// 5. Empty result
content = content.replace(
  "                if (trs.length === 0) {\r\n                   // Continua observando — o SSRS pode ter criado a estrutura mas ainda não populou as linhas.\r\n                   // Somente o timeout encerra a espera se as linhas nunca aparecerem.\r\n                   return;\r\n                }",
  "                if (trs.length === 0) {\n                   finish({ error: null, alunos: [] });\n                   return;\n                }"
);

// 6. Node.js timeout debug file
const nodeCodeOld = `        if (iframeState.error === 'table_not_found') {
          const debugPath = path.join(require('electron').app.getPath('userData'), 'data', 'debug_report_iframe.html');
          fs.writeFileSync(debugPath, iframeState.html || '', 'utf-8');
          log(\`═══════════════════════════════════════\`);
          log(\`A tabela de alunos não foi encontrada na Turma \${currentTurma.text}! Pulando para a próxima...\`);
          log(\`Iframe encontrado: \${iframeState.foundId}\`);
          log(\`═══════════════════════════════════════\`);
          
          atualizarLogScraping(logId, { status: 'extraindo_dados', mensagem: \`Turma \${currentTurma.text} sem tabela de alunos. Pulando.\` });
          scrapingState = 'SCRAPE_TURMA';
          continue;
        } else if (iframeState.error === 'cancelled') {`;

const nodeCodeNew = `        if (iframeState.error === 'iframe_not_found_timeout') {
          const debugPath = path.join(require('electron').app.getPath('userData'), 'data', 'debug_report_iframe.html');
          fs.writeFileSync(debugPath, iframeState.html || '', 'utf-8');
          throw new Error(\`Falha na extração do iframe para turma \${currentTurma.text}: \${iframeState.error} (Network Timeout)\`);
        } else if (iframeState.error === 'cancelled') {`;
content = content.split(nodeCodeOld).join(nodeCodeNew);

fs.writeFileSync('src/scraper/scraper.js', content);
