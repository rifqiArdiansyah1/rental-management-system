const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../tests/e2e');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts'));

files.forEach(file => {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace the string literally
  content = content.replace(/\.split\('T'\)\[0\]\);/g, '.split(\'T\')[0] + \'T00:00\');');
  
  // For race-condition.spec.ts
  content = content.replace(/await page1\.fill\('input\[type="datetime-local"\]', startStr\);/, "await page1.fill('input[type=\"datetime-local\"]', startStr + 'T00:00');");
  
  fs.writeFileSync(filePath, content);
  console.log(`Fixed ${file}`);
});
