'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function stopProcess(pid) {
  if (!Number.isInteger(pid) || pid < 2) return;
  try {
    process.kill(pid, 'SIGTERM');
  } catch (error) {
    if (error.code === 'ESRCH') return;
    throw error;
  }
  for (let i = 0; i < 30; i++) {
    try {
      process.kill(pid, 0);
      await pause(100);
    } catch (error) {
      if (error.code === 'ESRCH') return;
      throw error;
    }
  }
  try {
    process.kill(pid, 'SIGKILL');
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
  }
}

module.exports = async function cleanupE2ETemporaryFiles() {
  const tempRoot = os.tmpdir();
  for (const name of fs.readdirSync(tempRoot)) {
    if (!name.startsWith('stamp-family-e2e-')) continue;
    const target = path.join(tempRoot, name);
    const stat = fs.lstatSync(target);
    if (!stat.isDirectory()) continue;
    const marker = path.join(target, '.stamp-family-e2e-run');
    const pidFile = path.join(target, 'server.pid');
    if (!fs.existsSync(marker)) continue;
    if (fs.existsSync(pidFile)) {
      const pid = Number(fs.readFileSync(pidFile, 'utf8').trim());
      await stopProcess(pid);
    }
    fs.rmSync(target, { recursive: true, force: true });
  }
};
