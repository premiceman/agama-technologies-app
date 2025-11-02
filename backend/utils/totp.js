const crypto = require('crypto');

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function randomSecret(bytes = 20) {
  const buffer = crypto.randomBytes(bytes);
  return base32Encode(buffer);
}

function base32Encode(buffer) {
  let bits = '';
  let output = '';
  for (const byte of buffer) {
    bits += byte.toString(2).padStart(8, '0');
    while (bits.length >= 5) {
      const chunk = bits.slice(0, 5);
      bits = bits.slice(5);
      output += BASE32_ALPHABET[parseInt(chunk, 2)];
    }
  }
  if (bits.length) {
    output += BASE32_ALPHABET[parseInt(bits.padEnd(5, '0'), 2)];
  }
  return output;
}

function base32Decode(secret) {
  const cleaned = String(secret || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z2-7]/g, '');
  let bits = '';
  const output = [];
  for (const char of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) continue;
    bits += idx.toString(2).padStart(5, '0');
    while (bits.length >= 8) {
      const byte = bits.slice(0, 8);
      bits = bits.slice(8);
      output.push(parseInt(byte, 2));
    }
  }
  return Buffer.from(output);
}

function generateOtp(secretBuffer, counter) {
  const buffer = Buffer.alloc(8);
  const high = Math.floor(counter / 0x100000000);
  const low = counter & 0xffffffff;
  buffer.writeUInt32BE(high, 0);
  buffer.writeUInt32BE(low, 4);
  const hmac = crypto.createHmac('sha1', secretBuffer).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (code % 1000000).toString().padStart(6, '0');
}

function verifyToken({ token, secret, window = 1, step = 30, timestamp = Date.now() }) {
  if (!token || !secret) return false;
  const secretBuffer = base32Decode(secret);
  if (!secretBuffer.length) return false;
  const counter = Math.floor(timestamp / 1000 / step);
  for (let errorWindow = -window; errorWindow <= window; errorWindow += 1) {
    const expected = generateOtp(secretBuffer, counter + errorWindow);
    if (timingSafeEqual(token, expected)) {
      return true;
    }
  }
  return false;
}

function timingSafeEqual(a, b) {
  const bufferA = Buffer.from(String(a).padStart(6, '0'));
  const bufferB = Buffer.from(String(b).padStart(6, '0'));
  if (bufferA.length !== bufferB.length) return false;
  return crypto.timingSafeEqual(bufferA, bufferB);
}

function keyUri(accountName, issuer, secret) {
  const encodedName = encodeURIComponent(accountName);
  const encodedIssuer = encodeURIComponent(issuer);
  return `otpauth://totp/${encodedIssuer}:${encodedName}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}

module.exports = {
  generateSecret: randomSecret,
  keyUri,
  verifyToken
};
