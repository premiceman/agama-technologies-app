const fs = require('fs');
const path = require('path');

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src)) {
    const s = path.join(src, entry);
    const d = path.join(dest, entry);
    const st = fs.statSync(s);
    st.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
}

const SRC = path.resolve(__dirname, '..', '..', 'frontend');
const DEST = path.resolve(__dirname, '..', 'public');
try { fs.rmSync(DEST, { recursive: true, force: true }); } catch {}
copyDir(SRC, DEST);
console.log('✅ Copied frontend into backend/public');
