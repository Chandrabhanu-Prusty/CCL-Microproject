const fs = require('fs');

const content = fs.readFileSync('docs/openapi.yaml', 'utf8');

const regex = /\$ref:\s*['"]?#\/components\/([^'"\s]+)['"]?/g;
let match;
const missing = [];
let count = 0;

while ((match = regex.exec(content)) !== null) {
  count++;
  const target = match[1];
  const [section, name] = target.split('/');
  const checkPattern = new RegExp(`^  ${section}:[\\s\\S]*?^    ${name}:`, 'm');
  if (!checkPattern.test(content)) {
    missing.push(target);
  }
}

console.log(`Checked ${count} $ref occurrences.`);
if (missing.length > 0) {
  console.error('Missing references:', missing);
  process.exit(1);
} else {
  console.log('All $ref targets verified successfully!');
}

