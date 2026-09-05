const fs = require('fs');
const { spawnSync } = require('child_process');

function main() {
  const envLocalPath = '.env.local';
  const envBackupPath = '.env.local.backup';
  let hasBackup = false;

  try {
    if (fs.existsSync(envLocalPath)) {
      console.log('📦 Backing up .env.local to .env.local.backup');
      fs.renameSync(envLocalPath, envBackupPath);
      hasBackup = true;
    }

    console.log('🚀 Running Playwright tests...');
    const extraArgs = process.argv.slice(2);
    const result = spawnSync('npx', ['playwright', 'test', ...extraArgs], { stdio: 'inherit', shell: true });
    
    // Instead of process.exit which skips finally, store status and exit later
    process.exitCode = result.status;
  } catch (error) {
    console.error('Error running playwright:', error);
    process.exitCode = 1;
  } finally {
    if (hasBackup) {
      console.log('🔄 Restoring .env.local from backup');
      fs.renameSync(envBackupPath, envLocalPath);
    }
  }
}

main();
