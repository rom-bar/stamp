'use strict';

const { execFileSync, spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const port = process.env.STAMP_E2E_PORT || '4173';
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stamp-family-e2e-'));
const database = path.join(tempDir, 'test.db');
const binary = path.join(tempDir, 'stamp-family-test-server');
const marker = path.join(tempDir, '.stamp-family-e2e-run');
const serverEnv = { ...process.env, STAMP_DB: database };

function removeTempFiles() {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

try {
  execFileSync('go', ['build', '-o', binary, '.'], { cwd: root, stdio: 'ignore' });
  execFileSync(binary, ['create-admin', '-family', 'Family A', '-username', 'family_a', '-password', 'Test-password-2026'], {
    cwd: root, env: serverEnv, stdio: 'ignore',
  });
  execFileSync(binary, ['create-admin', '-family', 'Family B', '-username', 'family_b', '-password', 'Test-password-2026'], {
    cwd: root, env: serverEnv, stdio: 'ignore',
  });
  execFileSync(binary, ['create-admin', '-family', 'Family C', '-username', 'family_c', '-password', 'Test-password-2026'], {
    cwd: root, env: serverEnv, stdio: 'ignore',
  });
} catch (error) {
  removeTempFiles();
  throw error;
}

fs.writeFileSync(marker, 'created by the Playwright E2E helper\n');
const server = spawn(binary, ['serve'], {
  cwd: root,
  env: { ...serverEnv, STAMP_ADDR: `127.0.0.1:${port}` },
  stdio: 'inherit',
});
server.once('spawn', () => fs.writeFileSync(path.join(tempDir, 'server.pid'), String(server.pid)));
let shuttingDown = false;

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  if (server.exitCode !== null) {
    removeTempFiles();
    process.exit(0);
    return;
  }
  const forceKill = setTimeout(() => server.kill('SIGKILL'), 3000);
  server.once('exit', code => {
    clearTimeout(forceKill);
    removeTempFiles();
    process.exit(code || 0);
  });
  server.kill('SIGTERM');
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
server.on('error', error => {
  console.error('Could not start test server:', error.message);
  shutdown();
});
server.on('exit', code => {
  if (!shuttingDown) {
    removeTempFiles();
    process.exit(code || 0);
  }
});
