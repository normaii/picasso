const fs = require('fs');
let content = fs.readFileSync('src/scraper/scraper.js', 'utf-8');

const regex = /if \(f\.contentDocument && f\.contentDocument\.body\) \{\s*f\.contentDocument\.body\.setAttribute\('data-scraped-turma', 'INVALIDATING'\);/;
const replacement = `if (f.contentDocument && f.contentDocument.body) {
                    f.contentDocument.body.setAttribute('data-scraped-turma', 'INVALIDATING');
                    f.contentDocument.querySelectorAll('iframe, frame').forEach(subF => {
                       if (subF.contentDocument && subF.contentDocument.body) {
                          subF.contentDocument.body.setAttribute('data-scraped-turma', 'INVALIDATING');
                       }
                    });`;

content = content.replace(regex, replacement);

fs.writeFileSync('src/scraper/scraper.js', content);
