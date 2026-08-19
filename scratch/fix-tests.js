const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../tests/e2e');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts'));

files.forEach(file => {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace locator
  content = content.replace(/input\[type="date"\]/g, 'input[type="datetime-local"]');
  
  // Replace fill value to append T00:00
  // e.g. .fill(startDate.toISOString().split('T')[0]) -> .fill(startDate.toISOString().split('T')[0] + 'T00:00')
  content = content.replace(/\.fill\(([^)]+\.split\('T'\)\[0\])\)/g, '.fill($1 + \'T00:00\')');
  
  // Also check if there are hardcoded fill values like fill(startStr)
  content = content.replace(/\.fill\(startStr\)/g, '.fill(startStr + \'T00:00\')');
  content = content.replace(/\.fill\(endStr\)/g, '.fill(endStr + \'T00:00\')');

  fs.writeFileSync(filePath, content);
  console.log(`Updated ${file}`);
});
