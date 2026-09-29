const fs = require('fs');
const lines = fs.readFileSync('src/scraper/scraper.js', 'utf-8').split(/\r?\n/);
lines.splice(171, 9, 
"                     new Promise((res, rej) => {",
"                        let observer;",
"                        const cleanup = () => {",
"                           if (observer) observer.disconnect();",
"                           clearTimeout(failTimer);",
"                        };",
"                        const check = () => {",
"                           try {",
"                              const met = new Function(${JSON.stringify(readyCondition)})();",
"                              if (met) { cleanup(); res(true); }",
"                           } catch(e) {}",
"                        };",
"                        observer = new MutationObserver(check);",
"                        observer.observe(document.body, { childList: true, subtree: true, attributes: true });",
"                        const failTimer = setTimeout(() => { cleanup(); rej(new Error('Network Timeout (Ready Condition)')); }, ${timeoutMs});",
"                        check();",
"                     })"
);
fs.writeFileSync('src/scraper/scraper.js', lines.join('\n'));
