const fs = require('fs');
let content = fs.readFileSync('src/scraper/scraper.js', 'utf-8');

content = content.replace(/const poll = setInterval\(\(\) => \{[\s\S]*?\}, 200\);\s*const failTimer = setTimeout\(\(\) => \{ clearInterval\(poll\); rej\(new Error\('Network Timeout \\(Ready Condition\\)'\)\); \}, \$\{timeoutMs\}\);/, 
`let observer;
                        const cleanup = () => {
                           if (observer) observer.disconnect();
                           clearTimeout(failTimer);
                        };
                        const check = () => {
                           try {
                              const met = new Function(\\\`return \\\${JSON.stringify(readyCondition)}\\\`)();
                              if (met) { cleanup(); res(true); }
                           } catch(e) {}
                        };
                        observer = new MutationObserver(check);
                        observer.observe(document.body, { childList: true, subtree: true, attributes: true });
                        const failTimer = setTimeout(() => { cleanup(); rej(new Error('Network Timeout (Ready Condition)')); }, \\$\\{timeoutMs\\});
                        check();`);

// Wait, the new code has an error: new Function(\`return \${JSON.stringify(readyCondition)}\`)();
// Wait! The original code used: const met = new Function(\${JSON.stringify(readyCondition)})();
content = content.replace(/const met = new Function\(\\\`return \\\$\{JSON.stringify\(readyCondition\)\}\\\`\)\(\);/, 'const met = new Function(${JSON.stringify(readyCondition)})();');

fs.writeFileSync('src/scraper/scraper.js', content);
