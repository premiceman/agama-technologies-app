const jwt = require('jsonwebtoken');

const COOKIE = process.env.JWT_COOKIE_NAME || 'at_session';
const DAYS = parseInt(process.env.JWT_EXPIRES_DAYS || '7', 10);

function issueTokenCookie(res, payload) {
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: `${DAYS}d` });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: DAYS * 24 * 60 * 60 * 1000,
    path: '/'
  });
  return token;
}

function clearTokenCookie(res) {
  res.cookie(COOKIE, '', { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 1, path: '/' });
}

function requireAuth(req, res, next) {
  const token = req.cookies[COOKIE] || (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.auth = decoded;
    return next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

module.exports = { requireAuth, issueTokenCookie, clearTokenCookie };
