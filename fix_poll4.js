const fs = require('fs');
let content = fs.readFileSync('src/scraper/scraper.js', 'utf-8');

const startStr = "new Promise((res, rej) => {\\n                       const poll = setInterval(() => {";
const endStr = " Network Timeout (Ready Condition)')); }, \\$\\{timeoutMs\\});\\n                    })";
// Let's just find the exact block by string match since we know what it looks like.
const lines = content.split('\\n');
let startIdx = -1;
let endIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('new Promise((res, rej) => {') && lines[i+1].includes('const poll = setInterval(() => {')) {
    startIdx = i;
  }
  if (startIdx !== -1 && i > startIdx && lines[i].includes(' Network Timeout (Ready Condition)')) {
    endIdx = i;
    break;
  }
}

if (startIdx !== -1 && endIdx !== -1) {
  const newBlock = [
    "                    new Promise((res, rej) => {",
    "                       let observer;",
    "                       const cleanup = () => {",
    "                          if (observer) observer.disconnect();",
    "                          clearTimeout(failTimer);",
    "                       };",
    "                       const check = () => {",
    "                          try {",
    "                             const met = new Function(${JSON.stringify(readyCondition)})();",
    "                             if (met) { cleanup(); res(true); }",
    "                          } catch(e) {}",
    "                       };",
    "                       observer = new MutationObserver(check);",
    "                       observer.observe(document.body, { childList: true, subtree: true, attributes: true });",
    "                       const failTimer = setTimeout(() => { cleanup(); rej(new Error('Network Timeout (Ready Condition)')); }, ${timeoutMs});",
    "                       check();"
  ];
  
  lines.splice(startIdx, endIdx - startIdx, ...newBlock);
  fs.writeFileSync('src/scraper/scraper.js', lines.join('\\n'));
  console.log('Replaced successfully!');
} else {
  console.log('Not found.');
}
