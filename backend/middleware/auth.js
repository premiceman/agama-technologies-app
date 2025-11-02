const jwt = require('jsonwebtoken');

const COOKIE = process.env.JWT_COOKIE_NAME || 'at_session';
const DAYS = parseInt(process.env.JWT_EXPIRES_DAYS || '7', 10);
const SECRET = process.env.JWT_SECRET;
const CHALLENGE_EXPIRY_MINUTES = parseInt(process.env.LOGIN_CHALLENGE_MINUTES || '10', 10);

if (!SECRET) {
  throw new Error('JWT_SECRET environment variable is required for authentication middleware.');
}

function issueTokenCookie(res, payload) {
  const token = jwt.sign(payload, SECRET, { expiresIn: `${DAYS}d` });
  const secure = process.env.NODE_ENV === 'production';
  res.cookie(COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: DAYS * 24 * 60 * 60 * 1000,
    path: '/'
  });
  return token;
}

function clearTokenCookie(res) {
  const secure = process.env.NODE_ENV === 'production';
  res.cookie(COOKIE, '', { httpOnly: true, secure, sameSite: 'lax', maxAge: 1, path: '/' });
}

function requireAuth(req, res, next) {
  const token = req.cookies[COOKIE] || (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, SECRET);
    req.auth = decoded;
    return next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

function issueChallengeToken(payload, options = {}) {
  const expiresIn = options.expiresIn || `${CHALLENGE_EXPIRY_MINUTES}m`;
  return jwt.sign({ ...payload, challenge: true }, SECRET, { expiresIn });
}

function verifyChallengeToken(token) {
  try {
    const decoded = jwt.verify(token, SECRET);
    if (!decoded.challenge) return null;
    return decoded;
  } catch (err) {
    return null;
  }
}

module.exports = {
  requireAuth,
  issueTokenCookie,
  clearTokenCookie,
  issueChallengeToken,
  verifyChallengeToken
};
