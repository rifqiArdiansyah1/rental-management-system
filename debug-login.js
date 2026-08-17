const { spawn } = require('child_process');
const { chromium } = require('playwright');
const path = require('path');

async function test() {
  console.log('Building...');
  const build = spawn('npm', ['run', 'build'], { shell: true, stdio: 'inherit' });
  
  await new Promise(resolve => build.on('close', resolve));
  
  console.log('Starting server...');
  const server = spawn('npm', ['run', 'start'], { shell: true });
  
  server.stdout.on('data', data => process.stdout.write(data));
  server.stderr.on('data', data => process.stderr.write(data));

  // Wait 5 seconds for server to start
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  console.log('Launching browser...');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    await page.goto('http://localhost:3000/login');
    await page.fill('input[type="email"]', 'customer1@test.com');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    
    await page.waitForTimeout(3000); // wait for redirect
    console.log('Current URL after submit:', page.url());
  } catch (err) {
    console.error('Browser error:', err);
  } finally {
    await browser.close();
    server.kill();
  }
}

test();
