require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');

const { requireAuth, issueTokenCookie, clearTokenCookie } = require('./middleware/auth');
const { validateBody } = require('./middleware/validation');
const User = require('./models/User');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
if (isProduction) {
  app.use(helmet.hsts({ maxAge: 63072000, includeSubDomains: true, preload: true }));
}
app.use(helmet.frameguard({ action: 'deny' }));
app.use(helmet.referrerPolicy({ policy: 'no-referrer' }));

app.use(express.json({ limit: '512kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean)
);
const corsInstance = cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.size === 0 || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error('CORS_NOT_ALLOWED'));
  },
  credentials: true
});
app.use((req, res, next) => {
  corsInstance(req, res, err => {
    if (err && err.message === 'CORS_NOT_ALLOWED') {
      return res.status(403).json({ error: 'Origin not allowed' });
    }
    if (err) return next(err);
    return next();
  });
});

app.use(morgan('dev'));

const limiterDefaults = {
  windowMs: 15 * 60 * 1000,
  standardHeaders: true,
  legacyHeaders: false
};
const authLimiter = rateLimit({ ...limiterDefaults, max: 60 });
app.use('/api/auth', authLimiter);

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/agama_tech';
mongoose.set('strictQuery', true);
mongoose
  .connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('❌ MongoDB connection error', err);
    process.exit(1);
  });

const PLATFORM_DEFINITIONS = [
  {
    id: 'valuesphere',
    name: 'ValueSphere Consulting',
    strapline: 'Business value consulting reinvented for modern operators.',
    summary:
      'Deliver personal and enterprise-grade value assessments that translate strategy into measurable commercial outcomes.',
    licenseNotes: {
      personal: 'Personal ValueSphere Navigator assessments.',
      business: 'Navigator assessments plus Catalyst advisory squads.'
    }
  },
  {
    id: 'procurepath',
    name: 'ProcurePath Control Tower',
    strapline: 'The procurement nerve centre for orchestrating vendors, contracts, and governance.',
    summary:
      'Give procurement organisations a unified workspace for vendor intelligence, contract health, and negotiation playbooks.',
    requiresBusinessLicense: true,
    licenseNotes: {
      business: 'Business license unlocks full ProcurePath orchestration.'
    }
  },
  {
    id: 'revenueforge',
    name: 'RevenueForge AI Studio',
    strapline: 'AI-guided commercial execution from discovery through renewals.',
    summary:
      'Operationalise sales plays, qualification flows, and AI copilots that manage every lead to close.',
    requiresBusinessLicense: true,
    licenseNotes: {
      business: 'Business license unlocks collaborative AI sales workspaces.'
    }
  }
];

const PLATFORM_IDS = new Set(PLATFORM_DEFINITIONS.map(platform => platform.id));
const PERSONAL_ALLOWED_PLATFORMS = new Set(['valuesphere']);
const LICENSE_OPTIONS = ['personal', 'business'];

function normalisePlatformAccess(licenseTier, requested) {
  if (!LICENSE_OPTIONS.includes(licenseTier)) {
    return { error: 'Unknown license tier.' };
  }
  const selections = Array.isArray(requested)
    ? Array.from(new Set(requested.map(value => String(value))))
    : [];

  if (licenseTier === 'personal') {
    const disallowed = selections.filter(id => id && !PERSONAL_ALLOWED_PLATFORMS.has(id));
    if (disallowed.length > 0) {
      return { error: 'Personal licenses only include ValueSphere Consulting.' };
    }
    return { platformAccess: ['valuesphere'] };
  }

  const filtered = selections.filter(id => PLATFORM_IDS.has(id));
  if (filtered.length === 0) {
    return { error: 'Select at least one platform for your business license.' };
  }
  return { platformAccess: filtered };
}

const signupSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(8),
  company: z.string().trim().max(160).optional(),
  role: z.string().trim().max(160).optional(),
  industry: z.string().trim().max(160).optional(),
  licenseTier: z.enum(LICENSE_OPTIONS),
  platformAccess: z.array(z.string()).optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

const profileUpdateSchema = z.object({
  name: z.string().trim().max(120).optional(),
  company: z.string().trim().max(160).optional(),
  role: z.string().trim().max(160).optional(),
  industry: z.string().trim().max(160).optional(),
  licenseTier: z.enum(LICENSE_OPTIONS).optional(),
  platformAccess: z.array(z.string()).optional()
});

app.get('/api/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

app.get('/api/platforms', (req, res) => {
  res.json({ ok: true, platforms: PLATFORM_DEFINITIONS });
});

app.post('/api/auth/signup', validateBody(signupSchema), async (req, res) => {
  try {
    const { name, email, password, company, role, industry, licenseTier, platformAccess: requested } = req.validatedBody;
    const normalised = normalisePlatformAccess(licenseTier, requested);
    if (normalised.error) {
      return res.status(400).json({ error: normalised.error });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const user = await User.createSecure({
      name,
      email,
      password,
      company,
      role,
      industry,
      licenseTier,
      platformAccess: normalised.platformAccess
    });

    const token = issueTokenCookie(res, { uid: user._id.toString() });
    res.json({ ok: true, user: user.public(), token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/login', validateBody(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.validatedBody;
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await user.verifyPassword(password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = issueTokenCookie(res, { uid: user._id.toString() });
    res.json({ ok: true, user: user.public(), token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
  clearTokenCookie(res);
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.auth.uid);
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true, user: user.public(), platforms: PLATFORM_DEFINITIONS });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/auth/me', requireAuth, validateBody(profileUpdateSchema), async (req, res) => {
  try {
    const user = await User.findById(req.auth.uid);
    if (!user) return res.status(404).json({ error: 'Not found' });

    const payload = req.validatedBody;
    const nextLicenseTier = payload.licenseTier || user.licenseTier;
    const desiredPlatforms = payload.platformAccess || user.platformAccess;
    const normalised = normalisePlatformAccess(nextLicenseTier, desiredPlatforms);
    if (normalised.error) {
      return res.status(400).json({ error: normalised.error });
    }

    ['name', 'company', 'role', 'industry'].forEach(field => {
      if (payload[field] !== undefined) {
        user[field] = String(payload[field]).trim();
      }
    });

    user.licenseTier = nextLicenseTier;
    user.platformAccess = normalised.platformAccess;
    await user.save();
    res.json({ ok: true, user: user.public(), platforms: PLATFORM_DEFINITIONS });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to update profile' });
  }
});

app.delete('/api/auth/me', requireAuth, async (req, res) => {
  try {
    await User.deleteOne({ _id: req.auth.uid });
    clearTokenCookie(res);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to delete profile' });
  }
});

const PUBLIC_DIR = path.join(__dirname, 'public');
app.use(express.static(PUBLIC_DIR));

app.get('*', (req, res) => {
  const filePath = path.join(PUBLIC_DIR, 'index.html');
  res.sendFile(filePath);
});

const port = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(port, () => {
    console.log('🚀 Agama Technologies backend running on port', port);
  });
}

module.exports = app;
