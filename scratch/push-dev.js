const { execSync } = require('child_process');
require('dotenv').config({ path: '.env.local' });
execSync('npx prisma db push', { stdio: 'inherit', env: process.env });
