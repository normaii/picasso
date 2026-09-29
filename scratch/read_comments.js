const fs = require('fs');
const { execSync } = require('child_process');

const out = execSync('gh api repos/normaii/picasso/pulls/54/comments', { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
const comments = JSON.parse(out);

comments.forEach((c, idx) => {
  console.log(`================================================================`);
  console.log(`COMMENT #${idx + 1} | ID: ${c.id}`);
  console.log(`FILE: ${c.path}:${c.line || c.original_line}`);
  console.log(`BODY:`);
  console.log(c.body);
  console.log(`DIFF HUNK:`);
  console.log(c.diff_hunk);
  console.log(`================================================================\n`);
});
