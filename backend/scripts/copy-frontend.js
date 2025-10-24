/**
 * Copies ../frontend into ./public so the backend can serve the static website on Render.
 */
const fs = require('fs');
const path = require('path');
const { packageSite } = require('./package-site');

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src)) {
    const s = path.join(src, entry);
    const d = path.join(dest, entry);
    const st = fs.statSync(s);
    if (st.isDirectory()) {
      copyDir(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

async function main() {
  const SRC = path.resolve(__dirname, '..', '..', 'frontend');
  const DEST = path.resolve(__dirname, '..', 'public');

  if (!fs.existsSync(SRC)) {
    console.error(`❌ Frontend source directory not found at ${SRC}`);
    process.exit(1);
  }

  try {
    fs.rmSync(DEST, { recursive: true, force: true });
  } catch {}
  copyDir(SRC, DEST);
  console.log('✅ Copied frontend into backend/public');

  const zipPath = path.join(DEST, 'downloads', 'agama-technologies-site.zip');
  await packageSite({ sourceDir: DEST, outputFile: zipPath });
  console.log('✅ Packaged downloadable site at', zipPath);
}

main().catch((err) => {
  console.error('❌ Failed to copy frontend', err);
  process.exit(1);
});
