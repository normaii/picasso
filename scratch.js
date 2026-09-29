const fs = require('fs');
let content = fs.readFileSync('src/scraper/scraper.js', 'utf-8');

const target = `                     new Promise((res, rej) => {
                        const poll = setInterval(() => {
                           try {
                             const met = new Function(\${JSON.stringify(readyCondition)})();
                             if (met) { clearInterval(poll); clearTimeout(failTimer); res(true); }
                           } catch(e) {}
                        }, 200);
                        const failTimer = setTimeout(() => { clearInterval(poll); rej(new Error('Network Timeout (Ready Condition)')); }, \${timeoutMs});
                     })`;

const repl = `                     new Promise((res, rej) => {
                        let observer;
                        const cleanup = () => {
                           if (observer) observer.disconnect();
                           clearTimeout(failTimer);
                        };
                        const check = () => {
                           try {
                              const met = new Function(\${JSON.stringify(readyCondition)})();
                              if (met) { cleanup(); res(true); }
                           } catch(e) {}
                        };
                        observer = new MutationObserver(check);
                        observer.observe(document.body, { childList: true, subtree: true, attributes: true });
                        const failTimer = setTimeout(() => { cleanup(); rej(new Error('Network Timeout (Ready Condition)')); }, \${timeoutMs});
                        check();
                     })`;

content = content.replace(target, repl);
fs.writeFileSync('src/scraper/scraper.js', content);
