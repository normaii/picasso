const fs = require('fs');
let content = fs.readFileSync('src/scraper/scraper.js', 'utf-8');

const target = "                     new Promise((res, rej) => {\\n" +
"                        const poll = setInterval(() => {\\n" +
"                           try {\\n" +
"                             const met = new Function(${JSON.stringify(readyCondition)})();\\n" +
"                             if (met) { clearInterval(poll); clearTimeout(failTimer); res(true); }\\n" +
"                           } catch(e) {}\\n" +
"                        }, 200);\\n" +
"                        const failTimer = setTimeout(() => { clearInterval(poll); rej(new Error('Network Timeout (Ready Condition)')); }, ${timeoutMs});\\n" +
"                     })";

content = content.replace(/const poll = setInterval\(\(\) => \{[\s\S]*?\}, 200\);\s*const failTimer = setTimeout\(\(\) => \{ clearInterval\(poll\); rej\(new Error\('Network Timeout \(Ready Condition\)'\)\); \}, \$\{timeoutMs\}\);/, 
\`let observer;
                        const cleanup = () => {
                           if (observer) observer.disconnect();
                           clearTimeout(failTimer);
                        };
                        const check = () => {
                           try {
                              const met = new Function(\\\${\\\JSON.stringify(readyCondition)})();
                              if (met) { cleanup(); res(true); }
                           } catch(e) {}
                        };
                        observer = new MutationObserver(check);
                        observer.observe(document.body, { childList: true, subtree: true, attributes: true });
                        const failTimer = setTimeout(() => { cleanup(); rej(new Error('Network Timeout (Ready Condition)')); }, \\\${timeoutMs});
                        check();\`);

fs.writeFileSync('src/scraper/scraper.js', content);
