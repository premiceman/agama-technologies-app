const jwt = require('jsonwebtoken');
const User = require('../models/User');

const COOKIE = process.env.JWT_COOKIE_NAME || 'at_session';
const SESSION_MS =
  parseInt(process.env.JWT_EXPIRES_MS || '0', 10) ||
  parseInt(process.env.JWT_EXPIRES_HOURS || '0', 10) * 60 * 60 * 1000 ||
  parseInt(process.env.JWT_EXPIRES_DAYS || '0', 10) * 24 * 60 * 60 * 1000 ||
  60 * 60 * 1000; // Default to 1 hour to enforce idle timeout
const SECRET = process.env.JWT_SECRET;
const SECURE_COOKIE = process.env.NODE_ENV === 'production';

if (!SECRET) {
  throw new Error('JWT_SECRET environment variable is required for authentication middleware.');
}

function issueTokenCookie(res, payload) {
  const expiresInSeconds = Math.max(1, Math.floor(SESSION_MS / 1000));
  const token = jwt.sign(payload, SECRET, { expiresIn: expiresInSeconds });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    secure: SECURE_COOKIE,
    sameSite: 'lax',
    maxAge: SESSION_MS,
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
    if (user?.forceLogoutAt && decoded.iat && decoded.iat * 1000 < user.forceLogoutAt.getTime()) {
      clearTokenCookie(res);
      return res.status(401).json({ error: 'Session expired. Please sign in again.' });
    }
    if (!user || user.status !== 'active') {
      clearTokenCookie(res);
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const orgId = decoded.orgId || (user.defaultOrganization ? user.defaultOrganization.toString() : null);
    const shouldRefresh =
      !decoded.exp || decoded.exp * 1000 - Date.now() < SESSION_MS / 2 || decoded.orgId !== orgId;
    if (shouldRefresh) {
      issueTokenCookie(res, {
        uid: decoded.uid,
        orgId
      });
    }

    req.auth = { ...decoded, orgId };
    req.requestingUser = user;
    return next();
  } catch (err) {
    console.error('Auth middleware error', err);
    clearTokenCookie(res);
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

module.exports = { requireAuth, issueTokenCookie, clearTokenCookie };
