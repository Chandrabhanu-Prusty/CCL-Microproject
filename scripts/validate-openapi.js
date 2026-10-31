const fs = require('fs');
const { execSync } = require('child_process');

console.log('--- Step 1: Validating internal $ref targets ---');
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

console.log('\n--- Step 2: Validating OpenAPI 3.1 specification via Redocly CLI ---');
try {
  const output = execSync('npx --yes @redocly/cli lint docs/openapi.yaml', {
    encoding: 'utf8',
    stdio: 'pipe'
  });
  console.log(output);
  console.log('Redocly linting passed with 0 errors/warnings!');
} catch (error) {
  console.error('Redocly linting failed:');
  console.error(error.stdout || error.message);
  process.exit(1);
}
