const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

async function packageSite({ sourceDir, outputFile }) {
  await fs.promises.mkdir(path.dirname(outputFile), { recursive: true });
  try {
    await fs.promises.unlink(outputFile);
  } catch {}

  return new Promise((resolve, reject) => {
    const zipArgs = ['-r', outputFile, '.', '-x', 'downloads/*'];
    const proc = spawn('zip', zipArgs, {
      cwd: sourceDir,
      stdio: 'inherit'
    });

    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`zip command exited with code ${code}`));
    });
    proc.on('error', reject);
  });
}

if (require.main === module) {
  const sourceDir = path.resolve(__dirname, '..', 'public');
  const outputFile = path.resolve(__dirname, '..', 'public', 'downloads', 'agama-technologies-site.zip');
  packageSite({ sourceDir, outputFile })
    .then(() => console.log('📦 Packaged site to', outputFile))
    .catch((err) => {
      console.error('❌ Failed to package site', err);
      process.exit(1);
    });
}

module.exports = { packageSite };
