import { execSync } from 'child_process';
import dotenv from 'dotenv';
import path from 'path';

export default async function globalSetup() {
  console.log('\n=======================================');
  console.log('🔄 Setting up testing environment...');
  
  // Load .env.test variables
  const envConfig = dotenv.config({ path: path.resolve(__dirname, '../.env.test') });
  
  if (envConfig.error || !envConfig.parsed) {
    throw new Error('Failed to load .env.test file. Please ensure it exists.');
  }

  const { DATABASE_URL, DIRECT_URL } = envConfig.parsed;

  if (!DATABASE_URL || !DIRECT_URL) {
    throw new Error('DATABASE_URL or DIRECT_URL is missing in .env.test');
  }

  // Ensure we are definitely NOT targeting the dev/prod database by mistake
  if (DATABASE_URL.includes('pvtiockfnwsktzkqqzjl')) {
    console.warn('⚠️ WARNING: Using the development database! E2E tests are blocked to prevent data loss.');
    throw new Error('E2E Blocked: DATABASE_URL points to dev DB.');
  }

  try {
    console.log('🗑️  Resetting database (prisma db push --force-reset)...');
    execSync('npx prisma db push --force-reset', {
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL,
        DIRECT_URL,
        PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "kredensialnya telah saya buatkan untuk production, Proceed"
      }
    });

    console.log('🛠️  Adding exclusions constraints (run-migration.ts)...');
    execSync('npx tsx run-migration.ts', {
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL,
        DIRECT_URL
      }
    });

    console.log('🌱 Running test-specific seed (tests/fixtures/seed.ts)...');
    execSync('npx tsx tests/fixtures/seed.ts', {
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL,
        DIRECT_URL
      }
    });
    console.log('✅ Testing environment setup complete.');
    console.log('=======================================\n');
  } catch (error) {
    console.error('❌ Failed to reset testing database:', error);
    throw error;
  }
}
