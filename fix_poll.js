const fs = require('fs');
let content = fs.readFileSync('src/scraper/scraper.js', 'utf-8');

const target = `                     new Promise((res, rej) => {
                        const poll = setInterval(() => {
                           try {
                             const met = new Function(\\$\\{JSON.stringify(readyCondition)\\})();
                             if (met) { clearInterval(poll); clearTimeout(failTimer); res(true); }
                           } catch(e) {}
                        }, 200);
                        const failTimer = setTimeout(() => { clearInterval(poll); rej(new Error('Network Timeout (Ready Condition)')); }, \\$\\{timeoutMs\\});
                     })`;
// Wait, target in the original code is NOT escaped!
const targetReal = "                     new Promise((res, rej) => {\r\n" +
"                        const poll = setInterval(() => {\r\n" +
"                           try {\r\n" +
"                             const met = new Function(${JSON.stringify(readyCondition)})();\r\n" +
"                             if (met) { clearInterval(poll); clearTimeout(failTimer); res(true); }\r\n" +
"                           } catch(e) {}\r\n" +
"                        }, 200);\r\n" +
"                        const failTimer = setTimeout(() => { clearInterval(poll); rej(new Error('Network Timeout (Ready Condition)')); }, ${timeoutMs});\r\n" +
"                     })";

const replacement = "                     new Promise((res, rej) => {\r\n" +
"                        let observer;\r\n" +
"                        const cleanup = () => {\r\n" +
"                           if (observer) observer.disconnect();\r\n" +
"                           clearTimeout(failTimer);\r\n" +
"                        };\r\n" +
"                        const check = () => {\r\n" +
"                           try {\r\n" +
"                              const met = new Function(${JSON.stringify(readyCondition)})();\r\n" +
"                              if (met) { cleanup(); res(true); }\r\n" +
"                           } catch(e) {}\r\n" +
"                        };\r\n" +
"                        observer = new MutationObserver(check);\r\n" +
"                        observer.observe(document.body, { childList: true, subtree: true, attributes: true });\r\n" +
"                        const failTimer = setTimeout(() => { cleanup(); rej(new Error('Network Timeout (Ready Condition)')); }, ${timeoutMs});\r\n" +
"                        check();\r\n" +
"                     })";

content = content.split(targetReal).join(replacement);
fs.writeFileSync('src/scraper/scraper.js', content);
