const jwt = require('jsonwebtoken');
const User = require('../models/User');

const COOKIE = process.env.JWT_COOKIE_NAME || 'at_session';
const DAYS = parseInt(process.env.JWT_EXPIRES_DAYS || '7', 10);
const SECRET = process.env.JWT_SECRET;
const SECURE_COOKIE = process.env.NODE_ENV === 'production';

if (!SECRET) {
  throw new Error('JWT_SECRET environment variable is required for authentication middleware.');
}

function issueTokenCookie(res, payload) {
  const token = jwt.sign(payload, SECRET, { expiresIn: `${DAYS}d` });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    secure: SECURE_COOKIE,
    sameSite: 'lax',
    maxAge: DAYS * 24 * 60 * 60 * 1000,
    path: '/'
  });
  return token;
}

function clearTokenCookie(res) {
  res.cookie(COOKIE, '', { httpOnly: true, secure: SECURE_COOKIE, sameSite: 'lax', maxAge: 1, path: '/' });
}

async function requireAuth(req, res, next) {
  const token = req.cookies[COOKIE] || (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, SECRET);
    const user = await User.findById(decoded.uid);
    if (!user || user.status !== 'active') {
      clearTokenCookie(res);
      return res.status(403).json({ error: 'Unauthorized' });
    }

    req.auth = decoded;
    req.requestingUser = user;
    return next();
  } catch (err) {
    console.error('Auth middleware error', err);
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

module.exports = { requireAuth, issueTokenCookie, clearTokenCookie };
