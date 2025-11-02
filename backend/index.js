require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
const rateLimit = require('express-rate-limit');
const csrf = require('csurf');
const multer = require('multer');
const { z } = require('zod');

const { Readable } = require('stream');
const { getStripe, isStripeConfigured, isStripeStub } = require('./utils/stripe');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(Boolean)
);

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
if (isProduction) {
  app.use(helmet.hsts({ maxAge: 63072000, includeSubDomains: true, preload: true }));
}
app.use(helmet.frameguard({ action: 'deny' }));
app.use(helmet.referrerPolicy({ policy: 'no-referrer' }));

app.use(
  express.json({
    limit: '1mb',
    verify: (req, res, buf) => {
      if (req.originalUrl.startsWith('/api/payments/webhook')) {
        req.rawBody = Buffer.from(buf);
      }
    }
  })
);
app.use(express.urlencoded({ extended: true }));
const csvTextParser = express.text({ type: ['text/csv', 'application/csv', 'text/plain'], limit: '200kb' });
app.use(cookieParser());

const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction
  }
});
const csrfExemptPaths = ['/api/payments/webhook'];
const csrfDisabled = process.env.NODE_ENV === 'test';
app.use((req, res, next) => {
  if (csrfDisabled) return next();
  if (csrfExemptPaths.some(prefix => req.originalUrl.startsWith(prefix))) {
    return next();
  }
  return csrfProtection(req, res, next);
});

app.get('/api/csrf-token', (req, res) => {
  try {
    res.json({ token: req.csrfToken() });
  } catch (err) {
    res.status(500).json({ error: 'Unable to issue CSRF token' });
  }
});

const defaultAllowedOrigins = isProduction
  ? []
  : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5173', 'http://127.0.0.1:5173'];
const allowedOrigins = new Set(
  [...defaultAllowedOrigins, ...(process.env.ALLOWED_ORIGINS || '').split(',')]
    .map(origin => origin.trim())
    .filter(Boolean)
);
const corsInstance = cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.has(origin)) return callback(null, true);
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
const authLimiter = rateLimit({ ...limiterDefaults, max: 30 });
const projectLimiter = rateLimit({ ...limiterDefaults, max: 200 });
const assessmentLimiter = rateLimit({ ...limiterDefaults, max: 120 });
const analyticsLimiter = rateLimit({ ...limiterDefaults, max: 60 });
const vendorSearchLimiter = rateLimit({ ...limiterDefaults, max: 40 });
const paymentsLimiter = rateLimit({ ...limiterDefaults, max: 20 });
const paymentsWebhookLimiter = rateLimit({ ...limiterDefaults, max: 400 });
const adminLimiter = rateLimit({ ...limiterDefaults, max: 30 });
const fileRouteLimiter = rateLimit({
  ...limiterDefaults,
  max: 60,
  keyGenerator: req => (req.auth?.uid ? `user:${req.auth.uid}` : req.ip)
});
const jobRouteLimiter = rateLimit({
  ...limiterDefaults,
  max: 40,
  keyGenerator: req => (req.auth?.uid ? `user:${req.auth.uid}` : req.ip)
});

app.use('/api/auth', authLimiter);
app.use('/api/projects', projectLimiter);
app.use('/api/assessments', assessmentLimiter);
app.use('/api/projects/:projectId/assessments', assessmentLimiter);
app.use('/api/payments/checkout', paymentsLimiter);
app.use('/api/payments/webhook', paymentsWebhookLimiter);
app.use('/api/admin', adminLimiter);

mongoose.set('strictQuery', true);

async function ensureMongoConnection() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/agama_tech';
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }
  if (mongoose.connection.readyState === 2) {
    await new Promise((resolve, reject) => {
      mongoose.connection.once('open', resolve);
      mongoose.connection.once('error', reject);
    });
    return mongoose.connection;
  }
  if (mongoose.connection.readyState === 3) {
    await new Promise(resolve => {
      mongoose.connection.once('disconnected', resolve);
    });
    return ensureMongoConnection();
  }
  await mongoose.connect(uri);
  console.log('✅ MongoDB connected');
  return mongoose.connection;
}

if (process.env.NODE_ENV !== 'test') {
  ensureMongoConnection().catch(err => {
    console.error('❌ MongoDB connection error', err);
    process.exit(1);
  });
}

let gridFsBucket;
function getGridFsBucket() {
  if (!gridFsBucket && mongoose.connection.readyState === 1 && mongoose.connection.db) {
    gridFsBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'projectFiles' });
  }
  if (!gridFsBucket) {
    throw new Error('File storage unavailable');
  }
  return gridFsBucket;
}

mongoose.connection.on('connected', () => {
  try {
    getGridFsBucket();
  } catch (err) {
    console.error('Failed to initialise GridFS bucket', err);
  }
});

function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', chunk => chunks.push(chunk));
    stream.once('error', reject);
    stream.once('end', () => resolve(Buffer.concat(chunks)));
  });
}

const User = require('./models/User');
const Assessment = require('./models/Assessment');
const Project = require('./models/Project');
const Report = require('./models/Report');
const Payment = require('./models/Payment');
const Entitlement = require('./models/Entitlement');
const BusinessMetric = require('./models/BusinessMetric');
const Initiative = require('./models/Initiative');
const Vendor = require('./models/Vendor');
const RfpTemplate = require('./models/RfpTemplate');
const RfpDraft = require('./models/RfpDraft');
const File = require('./models/File');
const Job = require('./models/Job');
const AuditLog = require('./models/AuditLog');

const {
  requireAuth,
  issueTokenCookie,
  clearTokenCookie,
  issueChallengeToken,
  verifyChallengeToken
} = require('./middleware/auth');
const { generateSecret: generateTotpSecret, keyUri: totpKeyUri, verifyToken: verifyTotpToken } = require('./utils/totp');

async function recordLoginEvent(userId, req, status, detail = '') {
  try {
    const ipHeader = req.headers['x-forwarded-for'] || '';
    const ip = Array.isArray(ipHeader)
      ? ipHeader[0]
      : ipHeader.split(',').map(part => part.trim()).filter(Boolean)[0] || req.ip;
    const userAgent = String(req.headers['user-agent'] || '').slice(0, 300);
    await User.updateOne(
      { _id: userId },
      {
        $push: {
          loginAudit: {
            $each: [
              {
                at: new Date(),
                ip,
                userAgent,
                status,
                detail: detail ? detail.slice(0, 200) : undefined
              }
            ],
            $slice: -30
          }
        }
      }
    ).exec();
  } catch (err) {
    console.warn('Failed to record login audit', err);
  }
}
const { requireProjectOwnership } = require('./middleware/project');
const { validateBody } = require('./middleware/validation');
const { computeReport } = require('./utils/scoring');
const { computeProjectAnalyticsSnapshot } = require('./utils/analytics');
const { createDocx } = require('./utils/docx');
const {
  recordMaturityTimepoint,
  queueProjectAnalyticsRecompute,
  getProjectAnalyticsSummary,
  getMaturityTimeseries,
  recomputeProjectAnalytics
} = require('./utils/project-analytics');
const {
  INDUSTRIES,
  OFFICIAL_ORGANISATIONS,
  STRATEGIC_DRIVERS,
  CAPABILITY_CATALOG,
  getQuestionnaire,
  getCapability
} = require('./data/catalog');
const {
  fetchOrganizationIntel,
  searchOrganizationProfiles,
  generateFollowUpPrompts,
  generateAssessmentAssistantReply,
  generateRfpDraft,
  uploadFileToOpenAI,
  createVectorStore,
  attachFileToVectorStore,
  detachFileFromVectorStore,
  deleteOpenAIFile
} = require('./utils/openai');
const { vendorMatch } = require('./utils/llm-tools');
const {
  sanitizeReportForTier,
  resolveTierForUser,
  getActiveEntitlement,
  attachAccessToReports,
  grantEntitlement,
  tierAllowsStrategic,
  tierRank
} = require('./utils/entitlements');

const MAX_FILE_UPLOAD_BYTES = parseInt(process.env.FILE_UPLOAD_MAX_BYTES || '20971520', 10);
const fileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_UPLOAD_BYTES }
});
const allowedFileTypes = new Set(
  (process.env.FILE_ALLOWED_MIME ||
    'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown')
    .split(',')
    .map(type => type.trim())
    .filter(Boolean)
);

function isAllowedFileType(mime) {
  if (!mime) return false;
  if (allowedFileTypes.has(mime)) return true;
  if (mime.startsWith('text/')) return allowedFileTypes.has('text/plain') || allowedFileTypes.has('text/*');
  return false;
}

const signupSchema = z.object({
  name: z.string().trim().max(120).optional(),
  email: z.string().email(),
  password: z.string().min(8),
  company: z.string().trim().max(160).optional(),
  role: z.string().trim().max(160).optional(),
  industry: z.string().trim().max(160).optional()
});

const sixDigitCode = z
  .string()
  .trim()
  .regex(/^\d{6}$/);

const loginSchema = z
  .object({
    stage: z.enum(['password', 'challenge']).optional(),
    email: z.string().email().optional(),
    password: z.string().min(8).optional(),
    challengeToken: z.string().min(10).optional(),
    otp: sixDigitCode.optional(),
    rememberDevice: z.boolean().optional()
  })
  .superRefine((data, ctx) => {
    const stage = data.stage || 'password';
    if (stage === 'challenge') {
      if (!data.challengeToken) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'challengeToken required', path: ['challengeToken'] });
      }
      if (!data.otp) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'otp required', path: ['otp'] });
      }
    } else {
      if (!data.email) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'email required', path: ['email'] });
      }
      if (!data.password) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'password required', path: ['password'] });
      }
    }
  });

const totpVerifySchema = z.object({
  code: sixDigitCode
});

const totpDisableSchema = z.object({
  code: sixDigitCode.optional()
});

const profileUpdateSchema = z.object({
  name: z.string().trim().max(120).optional(),
  company: z.string().trim().max(160).optional(),
  role: z.string().trim().max(160).optional(),
  industry: z.string().trim().max(160).optional()
});

const projectCreateSchema = z.object({
  name: z.string().trim().min(1).max(140),
  companyDomain: z.string().trim().max(160).optional(),
  industry: z.string().trim().min(1),
  region: z.string().trim().min(1),
  companySize: z.string().trim().min(1),
  headcount: z.coerce.number().int().nonnegative().optional(),
  stage: z.string().trim().max(120).optional(),
  riskAppetite: z.string().trim().max(120).optional(),
  strategicDrivers: z.array(z.string().trim()).max(20).optional(),
  capabilityFocus: z.array(z.string().trim()).max(20).optional(),
  overview: z.string().trim().max(500).optional(),
  companyProfile: z.record(z.any()).optional(),
  operatingModel: z.record(z.any()).optional(),
  techLandscape: z.record(z.any()).optional(),
  personas: z.array(z.record(z.any())).max(20).optional()
});

const projectUpdateSchema = projectCreateSchema.partial();

const fileScanSchema = z.object({
  status: z.enum(['clean', 'quarantined']),
  reason: z.string().trim().max(200).optional()
});

const ragIndexSchema = z.object({
  fileIds: z
    .array(
      z
        .string()
        .trim()
        .regex(/^[a-fA-F0-9]{24}$/, 'Invalid file id')
    )
    .min(1)
    .max(20)
});

const jobCreateSchema = z.object({
  type: z.enum(['persona-briefs', 'exec-narrative']),
  payload: z.record(z.any()).default({})
});

function serializeJob(job) {
  if (!job) return null;
  return {
    id: job._id?.toString(),
    type: job.type,
    status: job.status,
    payload: job.payload || {},
    result: job.result || null,
    attempts: job.attempts || 0,
    workerId: job.workerId || null,
    error: job.error || null,
    createdAt: job.createdAt || null,
    updatedAt: job.updatedAt || null
  };
}

const organizationEnrichSchema = z.object({
  query: z.string().max(200).optional(),
  capability: z.string().optional(),
  industry: z.string().optional(),
  fetchDetailsFor: z.string().optional()
});

const assessmentBaseSchema = z.object({
  stage: z.string().optional(),
  assessmentType: z.string().optional(),
  vertical: z.string().optional(),
  companySize: z.string().optional(),
  region: z.string().optional(),
  industry: z.string().optional(),
  strategicDrivers: z.array(z.string()).optional(),
  organization: z.object({}).passthrough().optional(),
  companyProfile: z.record(z.any()).optional(),
  capabilityFocus: z.array(z.string()).optional(),
  techLandscape: z.record(z.any()).optional(),
  personas: z.array(z.record(z.any())).optional(),
  vendorStrategy: z.record(z.any()).optional(),
  operatingModel: z.record(z.any()).optional(),
  stakeholderProfile: z.record(z.any()).optional(),
  investmentProfile: z.record(z.any()).optional(),
  initiativeTimeline: z.array(z.record(z.any())).optional(),
  architectureUploads: z.array(z.record(z.any())).optional(),
  architectureSignals: z.record(z.any()).optional(),
  answers: z.record(z.any()).optional(),
  premiumAnswers: z.record(z.any()).optional(),
  extendedAnswers: z.record(z.any()).optional(),
  commandAnswers: z.record(z.any()).optional()
});

const assessmentCreateSchema = assessmentBaseSchema.extend({
  projectId: z.string().optional()
});

const assessmentUpdateSchema = assessmentBaseSchema.extend({
  nextAssessmentType: z.string().optional()
});

const followUpSchema = z.object({
  step: z.string().optional(),
  capabilityId: z.string().optional(),
  answers: z.record(z.any()).optional(),
  organization: z.record(z.any()).optional(),
  industry: z.string().optional()
});

const vendorSearchSchema = z.object({
  projectId: z.string(),
  capability: z.string().trim().max(160).optional(),
  query: z.string().trim().max(200).optional(),
  categories: z.array(z.string().trim()).max(10).optional(),
  strengths: z.array(z.string().trim()).max(10).optional(),
  constraints: z
    .object({
      pricing: z.string().trim().max(160).optional(),
      integrationNeeds: z.array(z.string().trim()).max(10).optional(),
      avoidTerms: z.array(z.string().trim()).max(10).optional()
    })
    .optional()
});

const rfpPhaseSchema = z.object({
  name: z.string().trim().min(1),
  durationWeeks: z.number().int().positive().max(52).optional(),
  activities: z.array(z.string().trim()).max(12).optional()
});

const rfpMaterializeSchema = z.object({
  projectId: z.string(),
  templateId: z.string().optional(),
  templateSlug: z.string().optional(),
  capability: z.string().trim().max(160).optional(),
  industry: z.string().trim().max(160).optional(),
  criteria: z
    .array(
      z.object({
        title: z.string().trim().min(1),
        weight: z.number().min(0).max(100).optional(),
        description: z.string().trim().max(500).optional()
      })
    )
    .max(20)
    .optional(),
  sections: z
    .array(
      z.object({
        title: z.string().trim().min(1),
        prompts: z.array(z.string().trim()).max(10).optional(),
        guidance: z.string().trim().max(500).optional()
      })
    )
    .max(12)
    .optional(),
  questions: z
    .array(
      z.object({
        section: z.string().trim().max(160).optional(),
        prompt: z.string().trim().min(1),
        guidance: z.string().trim().max(500).optional()
      })
    )
    .max(30)
    .optional(),
  scoringRubric: z.record(z.any()).optional(),
  timeline: z
    .object({
      phases: z.array(rfpPhaseSchema).max(12).optional(),
      targetLaunch: z.string().trim().max(160).optional()
    })
    .optional(),
  stakeholders: z
    .array(
      z.object({
        name: z.string().trim().min(1),
        role: z.string().trim().max(160).optional()
      })
    )
    .max(10)
    .optional(),
  assessmentId: z.string().optional()
});

const assistantSchema = z.object({
  message: z.string().min(1),
  capabilityId: z.string().optional(),
  draft: z.record(z.any()).optional()
});

const checkoutSchema = z.object({
  tier: z.enum(['strategic', 'command'])
});

const entitlementGrantSchema = z.object({
  userId: z.string().min(1),
  tier: z.enum(['free', 'strategic', 'command']),
  expiresAt: z.string().optional()
});

const TIER_REQUIREMENTS = {
  free: tierRank('free'),
  strategic: tierRank('strategic'),
  command: tierRank('command')
};

async function loadRequestEntitlement(req, { fallbackPaid = false } = {}) {
  if (req.entitlementInfo) return req.entitlementInfo;
  const { tier, record } = await resolveTierForUser(req.auth?.uid, fallbackPaid);
  req.entitlementInfo = { tier, record };
  return req.entitlementInfo;
}

function requireTierAccess(minTier = 'free') {
  return async function entitlementMiddleware(req, res, next) {
    try {
      const info = await loadRequestEntitlement(req);
      if ((TIER_REQUIREMENTS[info.tier] ?? 0) < (TIER_REQUIREMENTS[minTier] ?? 0)) {
        return res.status(403).json({ error: 'Upgrade required' });
      }
      return next();
    } catch (err) {
      console.error('Entitlement check failed', err);
      return res.status(500).json({ error: 'Unable to verify entitlement' });
    }
  };
}

const DEFAULT_CURRENCY = (process.env.STRIPE_CURRENCY || 'usd').toLowerCase();
const STRATEGIC_DEFAULT_AMOUNT = Number(process.env.STRIPE_AMOUNT_STRATEGIC || 25000);
const COMMAND_DEFAULT_AMOUNT = Number(process.env.STRIPE_AMOUNT_COMMAND || 250000);
const COMMAND_DEFAULT_MODE = (process.env.STRIPE_COMMAND_MODE || 'payment').toLowerCase();

function getTierCheckoutConfig(tier) {
  const currency = DEFAULT_CURRENCY;
  if (tier === 'strategic') {
    return {
      tier,
      name: 'Strategic Assessment Intelligence',
      amountCents: Number.isFinite(STRATEGIC_DEFAULT_AMOUNT) ? STRATEGIC_DEFAULT_AMOUNT : 25000,
      currency,
      mode: 'payment',
      priceId: process.env.STRIPE_PRICE_STRATEGIC || null
    };
  }
  if (tier === 'command') {
    const mode = COMMAND_DEFAULT_MODE === 'subscription' ? 'subscription' : 'payment';
    const priceIdPayment = process.env.STRIPE_PRICE_COMMAND || null;
    const priceIdSubscription = process.env.STRIPE_PRICE_COMMAND_SUBSCRIPTION || null;
    const priceId = mode === 'subscription' ? priceIdSubscription || priceIdPayment : priceIdPayment || priceIdSubscription;
    return {
      tier,
      name: 'Command Blueprint Programme',
      amountCents: Number.isFinite(COMMAND_DEFAULT_AMOUNT) ? COMMAND_DEFAULT_AMOUNT : 250000,
      currency,
      mode,
      priceId
    };
  }
  throw new Error('Unsupported tier');
}

async function isAdminUser(userId) {
  if (!userId) return false;
  const user = await User.findById(userId);
  if (!user) return false;
  return ADMIN_EMAILS.has(String(user.email || '').toLowerCase());
}

async function recordAuditLog(req, action, targetType, targetId, metadata = {}) {
  try {
    await AuditLog.create({
      actorId: req.auth?.uid || null,
      action,
      targetType,
      targetId,
      metadata,
      ip: req.ip,
      ua: req.headers['user-agent'] || '',
      ts: new Date()
    });
  } catch (err) {
    console.error('Failed to record audit log', err);
  }
}

const optionalMoney = z
  .union([
    z.coerce.number().nonnegative(),
    z.literal('').transform(() => undefined),
    z.null().transform(() => undefined)
  ])
  .optional()
  .transform(value => (value === undefined ? undefined : Number(value)));

const optionalHeadcount = z
  .union([
    z.coerce.number().nonnegative(),
    z.literal('').transform(() => undefined),
    z.null().transform(() => undefined)
  ])
  .optional()
  .transform(value => (value === undefined ? undefined : Number(value)));

const businessMetricSchema = z.object({
  year: z.coerce.number().int().min(1900).max(3000),
  arrUSD: optionalMoney,
  headcount: optionalHeadcount,
  source: z
    .object({
      type: z.enum(['manual', 'csv']),
      url: z.string().url().max(500).optional(),
      confidence: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional()
    })
    .default({ type: 'manual' }),
  notes: z.string().trim().max(500).optional()
});

const impactedPillarSchema = z.object({
  pillar: z.string().trim().min(1).max(120),
  expectedImpact: z.coerce.number().min(-3).max(3)
});

const initiativeSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  impactedPillars: z.array(impactedPillarSchema).max(12).optional(),
  status: z.enum(['planned', 'in-progress', 'done']).default('planned'),
  owner: z.string().trim().max(160).optional()
});

const initiativeUpdateSchema = initiativeSchema.partial();

app.get('/api/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

app.post('/api/auth/signup', validateBody(signupSchema), async (req, res) => {
  try {
    const { name, email, password, company, role, industry } = req.validatedBody;
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) return res.status(409).json({ error: 'Email already registered' });
    const user = await User.createSecure({ name, email, password, company, role, industry });
    const token = issueTokenCookie(res, { uid: user._id.toString() });
    res.json({ ok: true, user: user.public(), token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/login', validateBody(loginSchema), async (req, res) => {
  try {
    const body = req.validatedBody;

    if (body.stage === 'challenge') {
      const decoded = verifyChallengeToken(body.challengeToken);
      if (!decoded?.uid) {
        return res.status(401).json({ error: 'Challenge expired. Please sign in again.' });
      }
      const user = await User.findById(decoded.uid).select('+totp.secret');
      if (!user || !user.totp?.enabled || !user.totp.secret) {
        return res.status(401).json({ error: 'Multi-factor authentication is not active for this account.' });
      }
      const otpValid = verifyTotpToken({ token: body.otp, secret: user.totp.secret });
      if (!otpValid) {
        await recordLoginEvent(user._id, req, 'failed', 'otp');
        return res.status(401).json({ error: 'Invalid verification code' });
      }

      user.lastLoginAt = new Date();
      await user.save({ validateBeforeSave: false });
      await recordLoginEvent(user._id, req, 'success', 'otp');
      const token = issueTokenCookie(res, { uid: user._id.toString() });
      return res.json({ ok: true, user: user.public(), token });
    }

    const { email, password, otp } = body;
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+totp.secret');
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await user.verifyPassword(password);
    if (!valid) {
      await recordLoginEvent(user._id, req, 'failed', 'password');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const requiresOtp = Boolean(user.totp?.enabled && user.totp.secret);
    if (requiresOtp) {
      if (otp) {
        const otpValid = verifyTotpToken({ token: otp, secret: user.totp.secret });
        if (!otpValid) {
          await recordLoginEvent(user._id, req, 'failed', 'otp');
          return res.status(401).json({ error: 'Invalid verification code' });
        }
      } else {
        const challengeToken = issueChallengeToken({ uid: user._id.toString(), email: user.email });
        await recordLoginEvent(user._id, req, 'challenge', 'totp');
        return res.json({
          ok: true,
          status: 'OTP_REQUIRED',
          challengeToken,
          factors: { totp: true }
        });
      }
    }

    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });
    await recordLoginEvent(user._id, req, 'success', requiresOtp ? 'password+otp' : 'password');
    const token = issueTokenCookie(res, { uid: user._id.toString() });
    return res.json({ ok: true, user: user.public(), token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
  clearTokenCookie(res);
  res.json({ ok: true });
});

app.get('/api/auth/mfa', requireAuth, async (req, res) => {
  const user = await User.findById(req.auth.uid).select('+totp.pendingSecret');
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json({
    ok: true,
    totp: {
      enabled: Boolean(user.totp?.enabled),
      enrollmentPending: Boolean(user.totp?.pendingSecret),
      activatedAt: user.totp?.activatedAt || null
    }
  });
});

app.post('/api/auth/mfa/enroll', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.auth.uid).select('+totp.pendingSecret +totp.secret');
    if (!user) return res.status(404).json({ error: 'Not found' });

    const secret = generateTotpSecret();
    if (!user.totp) user.totp = {};
    user.totp.pendingSecret = secret;
    user.totp.enabled = false;
    await user.save({ validateBeforeSave: false });

    const issuer = process.env.MFA_ISSUER || 'Agama Technologies';
    const otpauth = totpKeyUri(user.email, issuer, secret);

    res.json({ ok: true, secret, otpauth });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to start MFA enrollment' });
  }
});

app.post('/api/auth/mfa/verify', requireAuth, validateBody(totpVerifySchema), async (req, res) => {
  try {
    const { code } = req.validatedBody;
    const user = await User.findById(req.auth.uid).select('+totp.pendingSecret +totp.secret');
    if (!user) return res.status(404).json({ error: 'Not found' });

    const pendingSecret = user.totp?.pendingSecret;
    const activeSecret = user.totp?.secret;
    const secretToTest = pendingSecret || activeSecret;

    if (!secretToTest) {
      return res.status(400).json({ error: 'No MFA enrollment in progress.' });
    }

    const valid = verifyTotpToken({ token: code, secret: secretToTest });
    if (!valid) {
      return res.status(401).json({ error: 'Invalid verification code' });
    }

    user.totp.secret = secretToTest;
    user.totp.pendingSecret = undefined;
    user.totp.enabled = true;
    user.totp.activatedAt = new Date();
    await user.save({ validateBeforeSave: false });

    res.json({ ok: true, totp: { enabled: true } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to verify MFA' });
  }
});

app.delete('/api/auth/mfa', requireAuth, validateBody(totpDisableSchema), async (req, res) => {
  try {
    const { code } = req.validatedBody;
    const user = await User.findById(req.auth.uid).select('+totp.secret');
    if (!user) return res.status(404).json({ error: 'Not found' });

    if (user.totp?.enabled && user.totp.secret) {
      if (!code || !verifyTotpToken({ token: code, secret: user.totp.secret })) {
        return res.status(401).json({ error: 'Verification code required to disable MFA' });
      }
    }

    user.totp = { enabled: false };
    await user.save({ validateBeforeSave: false });
    res.json({ ok: true, totp: { enabled: false } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to disable MFA' });
  }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.auth.uid);
  if (!user) return res.status(404).json({ error: 'Not found' });
  const { tier, record } = await resolveTierForUser(user._id);
  res.json({
    ok: true,
    user: user.public(),
    entitlement: { tier, expiresAt: record?.expiresAt || null }
  });
});

app.put('/api/auth/me', requireAuth, validateBody(profileUpdateSchema), async (req, res) => {
  try {
    const updates = {};
    Object.entries(req.validatedBody).forEach(([key, value]) => {
      if (value !== undefined) updates[key] = String(value).trim();
    });
    const user = await User.findByIdAndUpdate(req.auth.uid, updates, { new: true });
    if (!user) return res.status(404).json({ error: 'Not found' });
    const { tier, record } = await resolveTierForUser(user._id);
    res.json({
      ok: true,
      user: user.public(),
      entitlement: { tier, expiresAt: record?.expiresAt || null }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to update profile' });
  }
});

app.delete('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const userId = req.auth.uid;
    await Promise.all([
      Assessment.deleteMany({ userId }),
      Project.deleteMany({ userId }),
      Report.deleteMany({ userId }),
      Payment.deleteMany({ userId }),
      Entitlement.deleteMany({ userId })
    ]);
    await User.deleteOne({ _id: userId });
    clearTokenCookie(res);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to delete profile' });
  }
});

app.get('/api/projects', requireAuth, async (req, res) => {
  const [projects, entitlement] = await Promise.all([
    Project.find({ userId: req.auth.uid }).sort({ updatedAt: -1 }),
    getActiveEntitlement(req.auth.uid)
  ]);
  res.json({
    ok: true,
    projects: projects.map(project => project.public()),
    entitlement: {
      tier: entitlement?.tier || 'free',
      expiresAt: entitlement?.expiresAt || null
    }
  });
});

app.post('/api/projects', requireAuth, validateBody(projectCreateSchema), async (req, res) => {
  try {
    const payload = req.validatedBody;
    const projectData = {
      userId: req.auth.uid,
      name: String(payload.name).trim().slice(0, 140),
      companyDomain: String(payload.companyDomain || '').trim().slice(0, 160),
      industry: payload.industry,
      region: payload.region,
      companySize: payload.companySize,
      headcount: payload.headcount || 0,
      stage: payload.stage,
      riskAppetite: payload.riskAppetite,
      strategicDrivers: Array.isArray(payload.strategicDrivers)
        ? payload.strategicDrivers.slice(0, 10)
        : [],
      capabilityFocus: Array.isArray(payload.capabilityFocus)
        ? payload.capabilityFocus.slice(0, 12)
        : [],
      overview: String(payload.overview || '').trim().slice(0, 500),
      companyProfile: payload.companyProfile || {},
      operatingModel: payload.operatingModel || {},
      techLandscape: payload.techLandscape || {},
      personas: Array.isArray(payload.personas) ? payload.personas.slice(0, 12) : []
    };

    const hasProfile = projectData.companyProfile && Object.keys(projectData.companyProfile).length > 0;
    const orgTarget =
      projectData.companyProfile?.canonicalName ||
      projectData.companyProfile?.legalName ||
      projectData.companyDomain ||
      projectData.name;
    let organizationIntel = null;
    if (!hasProfile && orgTarget) {
      try {
        const assessmentFocus = Array.isArray(projectData.capabilityFocus) && projectData.capabilityFocus.length
          ? projectData.capabilityFocus[0]
          : 'Business Value Transformation';
        organizationIntel = await fetchOrganizationIntel({
          organization: orgTarget,
          assessmentType: assessmentFocus,
          industry: projectData.industry
        });
      } catch (err) {
        console.warn('Organisation enrichment failed', err.message || err);
      }
    }

    if (organizationIntel) {
      const existingProfile = projectData.companyProfile || {};
      const profileIntel = organizationIntel.profile || {};
      projectData.companyProfile = {
        ...existingProfile,
        summary: existingProfile.summary || organizationIntel.summary,
        canonicalName: existingProfile.canonicalName || profileIntel.canonicalName,
        classification: existingProfile.classification || profileIntel.classification,
        industryTags: Array.from(
          new Set([...(existingProfile.industryTags || []), ...(profileIntel.industryTags || [])])
        ),
        headcountEstimate: existingProfile.headcountEstimate || profileIntel.headcountEstimate,
        annualRevenueEstimate: existingProfile.annualRevenueEstimate || profileIntel.annualRevenueEstimate,
        fundingRounds: existingProfile.fundingRounds || profileIntel.fundingRounds || [],
        investmentHighlights: existingProfile.investmentHighlights || profileIntel.investmentHighlights || [],
        keyInitiatives: existingProfile.keyInitiatives || profileIntel.keyInitiatives || [],
        intel: organizationIntel
      };
      if (!projectData.overview && organizationIntel.summary) {
        projectData.overview = organizationIntel.summary.slice(0, 500);
      }
    }

    const snapshot = computeProjectAnalyticsSnapshot(projectData);
    const now = new Date();
    const analytics = {
      readinessScore: snapshot.readinessScore,
      clarityScore: snapshot.clarityScore,
      sentiment: snapshot.sentiment,
      driverCount: snapshot.driverCount,
      focusCount: snapshot.focusCount,
      stage: snapshot.stage,
      riskAppetite: snapshot.riskAppetite,
      maturity: {
        overall: snapshot.readinessScore,
        pillars: { readiness: snapshot.readinessScore },
        delta: { overall: 0, pillars: {} },
        history: { overall: [], pillars: {} },
        lastUpdated: now
      }
    };

    const project = await Project.create({ ...projectData, analytics });
    res.json({ ok: true, project: project.public() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to create project' });
  }
});

app.get('/api/projects/:id', requireAuth, async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, userId: req.auth.uid });
    if (!project) return res.status(404).json({ error: 'Not found' });
    const entitlement = await getActiveEntitlement(req.auth.uid);
    res.json({
      ok: true,
      project: project.public(),
      entitlement: {
        tier: entitlement?.tier || 'free',
        expiresAt: entitlement?.expiresAt || null
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to load project' });
  }
});

app.put('/api/projects/:id', requireAuth, validateBody(projectUpdateSchema), async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, userId: req.auth.uid });
    if (!project) return res.status(404).json({ error: 'Not found' });

    const updates = req.validatedBody;
    ['name', 'companyDomain', 'industry', 'region', 'companySize', 'stage', 'riskAppetite', 'overview'].forEach(field => {
      if (updates[field] !== undefined) {
        project[field] = String(updates[field]).trim();
      }
    });
    if (updates.headcount !== undefined) project.headcount = Number(updates.headcount) || 0;
    if (Array.isArray(updates.strategicDrivers)) project.strategicDrivers = updates.strategicDrivers.slice(0, 10);
    if (Array.isArray(updates.capabilityFocus)) project.capabilityFocus = updates.capabilityFocus.slice(0, 12);
    if (updates.companyProfile) project.companyProfile = updates.companyProfile;
    if (updates.operatingModel) project.operatingModel = updates.operatingModel;
    if (updates.techLandscape) project.techLandscape = updates.techLandscape;
    if (Array.isArray(updates.personas)) project.personas = updates.personas.slice(0, 12);

    const snapshot = computeProjectAnalyticsSnapshot(project.toObject());
    const now = new Date();
    project.analytics = {
      readinessScore: snapshot.readinessScore,
      clarityScore: snapshot.clarityScore,
      sentiment: snapshot.sentiment,
      driverCount: snapshot.driverCount,
      focusCount: snapshot.focusCount,
      stage: snapshot.stage,
      riskAppetite: snapshot.riskAppetite,
      maturity: {
        overall: snapshot.readinessScore,
        pillars: { readiness: snapshot.readinessScore },
        delta: { overall: 0, pillars: {} },
        history: { overall: [], pillars: {} },
        lastUpdated: now
      },
      timeseriesId: project.analytics?.timeseriesId || null
    };

    await project.save();
    const entitlement = await getActiveEntitlement(req.auth.uid);
    res.json({
      ok: true,
      project: project.public(),
      entitlement: {
        tier: entitlement?.tier || 'free',
        expiresAt: entitlement?.expiresAt || null
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to update project' });
  }
});

app.post(
  '/api/projects/:id/files',
  requireAuth,
  fileRouteLimiter,
  requireProjectOwnership('id'),
  fileUpload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'File is required' });
      }
      if (!isAllowedFileType(req.file.mimetype)) {
        return res.status(415).json({ error: 'Unsupported file type' });
      }
      const bucket = getGridFsBucket();
      const uploadStream = bucket.openUploadStream(req.file.originalname, {
        contentType: req.file.mimetype,
        metadata: {
          projectId: req.project._id.toString(),
          ownerId: req.auth.uid
        }
      });
      await new Promise((resolve, reject) => {
        Readable.from(req.file.buffer)
          .on('error', reject)
          .pipe(uploadStream)
          .on('error', reject)
          .on('finish', resolve);
      });
      const storedFile = await bucket.find({ _id: uploadStream.id }).next();
      if (!storedFile) {
        return res.status(500).json({ error: 'File storage failed' });
      }
      const fileDoc = await File.create({
        projectId: req.project._id,
        ownerId: req.auth.uid,
        storageId: storedFile._id,
        filename: storedFile.filename,
        length: storedFile.length,
        chunkSize: storedFile.chunkSize,
        uploadDate: storedFile.uploadDate,
        md5: storedFile.md5,
        mime: storedFile.contentType || req.file.mimetype,
        status: 'pending'
      });
      res.status(201).json({ file: fileDoc.toJSON() });
    } catch (err) {
      console.error('File upload failed', err);
      res.status(500).json({ error: 'Unable to upload file' });
    }
  }
);

app.get(
  '/api/projects/:id/files',
  requireAuth,
  fileRouteLimiter,
  requireProjectOwnership('id'),
  async (req, res) => {
    try {
      const files = await File.find({ projectId: req.project._id }).sort({ createdAt: -1 });
      res.json({ files: files.map(file => file.toJSON()) });
    } catch (err) {
      console.error('File list failed', err);
      res.status(500).json({ error: 'Unable to list files' });
    }
  }
);

app.get('/api/files/:fileId/download', requireAuth, fileRouteLimiter, async (req, res) => {
  try {
    const { fileId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      return res.status(400).json({ error: 'Invalid file id' });
    }
    const file = await File.findById(fileId);
    if (!file) return res.status(404).json({ error: 'File not found' });
    const isOwner = String(file.ownerId) === req.auth.uid;
    const isAdmin = await isAdminUser(req.auth.uid);
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (file.status === 'quarantined') {
      return res.status(423).json({ error: 'File is quarantined' });
    }
    const bucket = getGridFsBucket();
    await recordAuditLog(req, 'file.download', 'File', fileId, { filename: file.filename });
    res.setHeader('Content-Type', file.mime || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(file.filename)}"`
    );
    const downloadStream = bucket.openDownloadStream(file.storageId);
    downloadStream.on('error', err => {
      console.error('File download stream error', err);
      if (!res.headersSent) {
        res.status(404).json({ error: 'File not found' });
      } else {
        res.end();
      }
    });
    downloadStream.pipe(res);
  } catch (err) {
    console.error('File download failed', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Unable to download file' });
    }
  }
});

app.delete('/api/files/:fileId', requireAuth, fileRouteLimiter, async (req, res) => {
  try {
    const { fileId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      return res.status(400).json({ error: 'Invalid file id' });
    }
    const file = await File.findById(fileId);
    if (!file) return res.status(404).json({ error: 'File not found' });
    const isOwner = String(file.ownerId) === req.auth.uid;
    const isAdmin = await isAdminUser(req.auth.uid);
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const bucket = getGridFsBucket();
    try {
      await bucket.delete(file.storageId);
    } catch (err) {
      console.error('Failed to delete GridFS file', err);
    }
    if (file.openaiVectorStoreId && file.openaiFileId) {
      await detachFileFromVectorStore({
        vectorStoreId: file.openaiVectorStoreId,
        fileId: file.openaiFileId
      });
    }
    if (file.openaiFileId) {
      await deleteOpenAIFile(file.openaiFileId);
    }
    await File.deleteOne({ _id: file._id });
    await recordAuditLog(req, 'file.delete', 'File', fileId, { filename: file.filename });
    res.json({ ok: true });
  } catch (err) {
    console.error('File delete failed', err);
    res.status(500).json({ error: 'Unable to delete file' });
  }
});

app.post(
  '/api/files/:fileId/scan',
  requireAuth,
  fileRouteLimiter,
  validateBody(fileScanSchema),
  async (req, res) => {
    try {
      if (!(await isAdminUser(req.auth.uid))) {
        return res.status(403).json({ error: 'Admin required' });
      }
      const { fileId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(fileId)) {
        return res.status(400).json({ error: 'Invalid file id' });
      }
      const file = await File.findById(fileId);
      if (!file) return res.status(404).json({ error: 'File not found' });
      file.status = req.validatedBody.status;
      if (file.status === 'quarantined') {
        file.quarantineReason = req.validatedBody.reason || null;
        file.indexedAt = null;
      } else {
        file.quarantineReason = null;
      }
      await file.save();
      res.json({ file: file.toJSON() });
    } catch (err) {
      console.error('File scan update failed', err);
      res.status(500).json({ error: 'Unable to update file status' });
    }
  }
);

app.post(
  '/api/projects/:id/rag/index',
  requireAuth,
  fileRouteLimiter,
  requireProjectOwnership('id'),
  validateBody(ragIndexSchema),
  async (req, res) => {
    try {
      const { fileIds } = req.validatedBody;
      const objectIds = fileIds.map(id => new mongoose.Types.ObjectId(id));
      const query = {
        _id: { $in: objectIds },
        projectId: req.project._id
      };
      if (!(await isAdminUser(req.auth.uid))) {
        query.ownerId = req.auth.uid;
      }
      const files = await File.find(query);
      if (!files.length) {
        return res.status(404).json({ error: 'Files not found for project' });
      }
      if (files.some(file => file.status !== 'clean')) {
        return res.status(400).json({ error: 'Files must be marked clean before indexing' });
      }

      let vectorStoreId = req.project.ragVectorStoreId;
      if (!vectorStoreId) {
        vectorStoreId = await createVectorStore({ name: `project-${req.project._id}` });
        if (!vectorStoreId) {
          return res.status(502).json({ error: 'Unable to provision retrieval index' });
        }
        req.project.ragVectorStoreId = vectorStoreId;
        await req.project.save();
      }

      const bucket = getGridFsBucket();
      const updatedFiles = [];
      for (const file of files) {
        try {
          const downloadStream = bucket.openDownloadStream(file.storageId);
          const buffer = await streamToBuffer(downloadStream);
          const remote = await uploadFileToOpenAI({
            buffer,
            filename: file.filename,
            mime: file.mime
          });
          if (!remote?.id) {
            throw new Error('OpenAI upload failed');
          }
          await attachFileToVectorStore({ vectorStoreId, fileId: remote.id });
          file.openaiFileId = remote.id;
          file.openaiVectorStoreId = vectorStoreId;
          file.indexedAt = new Date();
          await file.save();
          updatedFiles.push(file.toJSON());
        } catch (err) {
          console.error('File indexing failed', err);
          return res.status(502).json({ error: 'Unable to index files' });
        }
      }

      res.json({ files: updatedFiles });
    } catch (err) {
      console.error('RAG indexing failed', err);
      res.status(500).json({ error: 'Unable to index retrieval files' });
    }
  }
);

app.get(
  '/api/projects/:id/analytics/summary',
  requireAuth,
  analyticsLimiter,
  requireProjectOwnership('id'),
  async (req, res) => {
    try {
      await recomputeProjectAnalytics(req.project._id);
      const summary = await getProjectAnalyticsSummary(req.project._id);
      res.json({ ok: true, ...summary });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Unable to load analytics summary' });
    }
  }
);

app.get(
  '/api/projects/:id/maturity/timeseries',
  requireAuth,
  analyticsLimiter,
  requireProjectOwnership('id'),
  async (req, res) => {
    try {
      const pillar = String(req.query.pillar || 'overall');
      const allowed = ['overall', 'Tech', 'Data', 'People', 'Process'];
      if (!allowed.includes(pillar)) {
        return res.status(400).json({ error: 'Unsupported pillar' });
      }
      const series = await getMaturityTimeseries(req.project._id, pillar);
      res.json({ ok: true, pillar, series });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Unable to load maturity timeseries' });
    }
  }
);

app.get(
  '/api/projects/:id/business/metrics',
  requireAuth,
  requireProjectOwnership('id'),
  async (req, res) => {
    try {
      const metrics = await BusinessMetric.find({ projectId: req.project._id }).sort({ year: -1 }).lean();
      res.json({ ok: true, metrics });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Unable to load business metrics' });
    }
  }
);

app.post(
  '/api/projects/:id/business/metrics',
  requireAuth,
  requireProjectOwnership('id'),
  validateBody(businessMetricSchema),
  async (req, res) => {
    try {
      const payload = req.validatedBody;
      const metric = await BusinessMetric.findOneAndUpdate(
        { projectId: req.project._id, year: payload.year },
        {
          projectId: req.project._id,
          year: payload.year,
          arrUSD: payload.arrUSD ?? null,
          headcount: payload.headcount ?? null,
          source: {
            type: payload.source?.type || 'manual',
            url: payload.source?.url || '',
            confidence: payload.source?.confidence !== undefined ? payload.source.confidence : 1
          },
          notes: payload.notes || ''
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      res.json({ ok: true, metric });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Unable to save business metric' });
    }
  }
);

app.post(
  '/api/projects/:id/business/metrics/upload',
  requireAuth,
  analyticsLimiter,
  requireProjectOwnership('id'),
  csvTextParser,
  async (req, res) => {
    try {
      if (!req.body || typeof req.body !== 'string') {
        return res.status(400).json({ error: 'CSV payload required' });
      }
      const rows = parseBusinessMetricsCsv(req.body);
      if (!rows.length) {
        return res.status(400).json({ error: 'No valid rows found' });
      }
      const results = [];
      for (const row of rows) {
        const payload = businessMetricSchema.parse({
          year: row.year,
          arrUSD: row.arrUSD,
          headcount: row.headcount,
          source: {
            type: 'csv',
            url: row.sourceUrl || '',
            confidence: row.sourceConfidence
          },
          notes: row.notes
        });
        const metric = await BusinessMetric.findOneAndUpdate(
          { projectId: req.project._id, year: payload.year },
          {
            projectId: req.project._id,
            year: payload.year,
            arrUSD: payload.arrUSD ?? null,
            headcount: payload.headcount ?? null,
            source: {
              type: 'csv',
              url: payload.source?.url || '',
              confidence:
                payload.source?.confidence !== undefined ? payload.source.confidence : row.sourceConfidence ?? 1
            },
            notes: payload.notes || ''
          },
          { new: true, upsert: true, setDefaultsOnInsert: true }
        );
        results.push(metric);
      }
      res.json({ ok: true, metrics: results });
    } catch (err) {
      console.error(err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid CSV data', details: err.errors });
      }
      res.status(400).json({ error: err.message || 'Unable to import CSV' });
    }
  }
);

app.get(
  '/api/projects/:id/initiatives',
  requireAuth,
  requireProjectOwnership('id'),
  async (req, res) => {
    try {
      const initiatives = await Initiative.find({ projectId: req.project._id }).sort({ startDate: -1 }).lean();
      res.json({ ok: true, initiatives });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Unable to load initiatives' });
    }
  }
);

app.post(
  '/api/projects/:id/initiatives',
  requireAuth,
  requireProjectOwnership('id'),
  validateBody(initiativeSchema),
  async (req, res) => {
    try {
      const payload = req.validatedBody;
      const initiative = await Initiative.create({
        projectId: req.project._id,
        title: payload.title,
        description: payload.description || '',
        startDate: payload.startDate,
        endDate: payload.endDate,
        impactedPillars: payload.impactedPillars || [],
        status: payload.status,
        owner: payload.owner || ''
      });
      res.json({ ok: true, initiative });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Unable to create initiative' });
    }
  }
);

app.put(
  '/api/projects/:id/initiatives/:initiativeId',
  requireAuth,
  requireProjectOwnership('id'),
  validateBody(initiativeUpdateSchema),
  async (req, res) => {
    try {
      const { initiativeId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(initiativeId)) {
        return res.status(400).json({ error: 'Invalid initiative id' });
      }
      const initiative = await Initiative.findOne({ _id: initiativeId, projectId: req.project._id });
      if (!initiative) {
        return res.status(404).json({ error: 'Initiative not found' });
      }
      const payload = req.validatedBody;
      if (payload.title !== undefined) initiative.title = payload.title;
      if (payload.description !== undefined) initiative.description = payload.description || '';
      if (payload.startDate !== undefined) initiative.startDate = payload.startDate;
      if (payload.endDate !== undefined) initiative.endDate = payload.endDate;
      if (payload.impactedPillars !== undefined) initiative.impactedPillars = payload.impactedPillars || [];
      if (payload.status !== undefined) initiative.status = payload.status;
      if (payload.owner !== undefined) initiative.owner = payload.owner || '';
      await initiative.save();
      res.json({ ok: true, initiative });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Unable to update initiative' });
    }
  }
);

app.get('/api/assessments/catalog', (req, res) => {
  res.json({
    ok: true,
    catalog: {
      capabilities: CAPABILITY_CATALOG,
      industries: INDUSTRIES,
      organisations: OFFICIAL_ORGANISATIONS,
      strategicDrivers: STRATEGIC_DRIVERS
    }
  });
});

app.post('/api/organizations/enrich', requireAuth, validateBody(organizationEnrichSchema), async (req, res) => {
  try {
    const { query, capability: capabilityId = 'security', industry, fetchDetailsFor } = req.validatedBody;

    const safeQuery = String(query || '').trim();
    if (!safeQuery && !fetchDetailsFor) {
      return res.status(400).json({ error: 'Organisation name required' });
    }

    const capability = getCapability(capabilityId) || CAPABILITY_CATALOG[0];
    const matches = safeQuery
      ? await searchOrganizationProfiles({
          query: safeQuery,
          capability: capability.name,
          industry
        })
      : { matches: [] };

    const detailTarget = String(fetchDetailsFor || safeQuery).trim();
    const intel = detailTarget
      ? await fetchOrganizationIntel({
          organization: detailTarget,
          assessmentType: capability.name,
          industry
        })
      : null;

    res.json({
      ok: true,
      matches: matches.matches,
      confidenceNote: matches.confidenceNote,
      intel
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to enrich organisation intelligence' });
  }
});

app.get('/api/assessments/questions', (req, res) => {
  const { stage = 'insight' } = req.query;
  const stageMap = { free: 'insight', premium: 'strategic' };
  const requested = stageMap[stage] || stage;
  const allowed = ['insight', 'strategic', 'command'];
  const safeStage = allowed.includes(requested) ? requested : 'insight';
  const questions = getQuestionnaire(safeStage);
  res.json({ ok: true, stage: safeStage, questions });
});

app.post('/api/assessments/follow-up', requireAuth, validateBody(followUpSchema), async (req, res) => {
  try {
    const { step, capabilityId = 'security', answers = {}, organization = {}, industry = '' } = req.validatedBody;
    const capability = getCapability(capabilityId) || CAPABILITY_CATALOG[0];
    const prompts = await generateFollowUpPrompts({
      step,
      capability: capability.name,
      answers,
      organization,
      industry
    });
    res.json({ ok: true, ...prompts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to generate follow-up prompts' });
  }
});

app.post(
  '/api/vendors/search',
  requireAuth,
  requireTierAccess('strategic'),
  vendorSearchLimiter,
  validateBody(vendorSearchSchema),
  requireProjectOwnership('projectId'),
  async (req, res) => {
    try {
      const filters = req.validatedBody;
      const shortlist = await vendorMatch({
        projectId: filters.projectId,
        capability: filters.capability || req.project?.capabilityFocus?.[0],
        categories: filters.categories,
        strengths: filters.strengths,
        query: filters.query,
        constraints: filters.constraints
      });
      res.json({ ok: true, matches: shortlist.matches || [] });
    } catch (err) {
      console.error('Vendor search failed', err);
      res.status(500).json({ error: 'Unable to search vendors' });
    }
  }
);

app.post(
  '/api/rfp/templates/materialize',
  requireAuth,
  requireTierAccess('strategic'),
  validateBody(rfpMaterializeSchema),
  requireProjectOwnership('projectId'),
  async (req, res) => {
    try {
      const {
        projectId,
        templateId,
        templateSlug,
        capability,
        industry,
        criteria,
        sections,
        questions,
        scoringRubric,
        timeline,
        stakeholders,
        assessmentId
      } = req.validatedBody;

      let template = null;
      if (templateId || templateSlug) {
        template = await RfpTemplate.findOne(
          templateId ? { _id: templateId } : { slug: templateSlug }
        ).lean();
        if ((templateId || templateSlug) && !template) {
          return res.status(404).json({ error: 'Template not found' });
        }
      }

      let assessment = null;
      if (assessmentId) {
        assessment = await Assessment.findOne({
          _id: assessmentId,
          projectId,
          userId: req.auth.uid
        }).lean();
        if (!assessment) {
          return res.status(404).json({ error: 'Assessment not found' });
        }
      }

      const overrides = {
        capability,
        industry,
        criteria,
        sections,
        questions,
        scoringRubric,
        timeline,
        stakeholders
      };

      const draftPayload = await generateRfpDraft({
        project: req.project ? req.project.toObject() : null,
        template,
        overrides,
        assessment
      });

      const timelinePayload = draftPayload.timeline || timeline || { phases: [] };
      if (!Array.isArray(timelinePayload.phases)) {
        timelinePayload.phases = [];
      }

      const finalCapability =
        draftPayload.capability ||
        capability ||
        template?.capability ||
        req.project?.capabilityFocus?.[0] ||
        'Capability';
      const finalIndustry = draftPayload.industry || industry || template?.industry || req.project?.industry;
      const finalCriteria = draftPayload.criteria || criteria || template?.criteria || [];
      const finalQuestions = draftPayload.questions || questions || [];
      const finalRubric = draftPayload.scoringRubric || scoringRubric || {};
      const finalStakeholders = draftPayload.stakeholders || stakeholders || [];

      const storedDraft = await RfpDraft.findOneAndUpdate(
        { projectId, capability: finalCapability },
        {
          projectId,
          assessmentId: assessment ? assessment._id : undefined,
          capability: finalCapability,
          industry: finalIndustry,
          criteria: finalCriteria,
          questions: finalQuestions,
          scoringRubric: finalRubric,
          timeline: timelinePayload,
          stakeholders: finalStakeholders
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      const responseDraft = storedDraft.toObject();
      responseDraft.sections = draftPayload.sections || sections || template?.sections || [];

      res.json({ ok: true, draft: responseDraft });
    } catch (err) {
      console.error('RFP materialization failed', err);
      res.status(500).json({ error: 'Unable to materialize RFP draft' });
    }
  }
);

app.get('/api/rfp/:id/export', requireAuth, async (req, res) => {
  try {
    const draft = await RfpDraft.findById(req.params.id).lean();
    if (!draft) {
      return res.status(404).json({ error: 'Not found' });
    }

    const project = await Project.findOne({ _id: draft.projectId, userId: req.auth.uid }).lean();
    if (!project) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const titleText = `${project.name || 'Project'} RFP Draft`;
    const sections = [
      {
        heading: 'Summary',
        lines: [
          `Capability: ${draft.capability}`,
          `Industry: ${draft.industry || '—'}`
        ]
      }
    ];

    if (Array.isArray(draft.criteria) && draft.criteria.length) {
      sections.push({
        heading: 'Evaluation criteria',
        lines: draft.criteria.map(item => {
          const weight = typeof item.weight === 'number' ? ` (weight ${item.weight}%)` : '';
          const desc = item.description ? ` — ${item.description}` : '';
          return `${item.title}${weight}${desc}`;
        })
      });
    }

    if (Array.isArray(draft.questions) && draft.questions.length) {
      sections.push({
        heading: 'Key questions',
        lines: draft.questions.map(item => {
          const prefix = item.section ? `[${item.section}] ` : '';
          const guidance = item.guidance ? ` — Guidance: ${item.guidance}` : '';
          return `${prefix}${item.prompt}${guidance}`;
        })
      });
    }

    if (draft.timeline?.phases?.length) {
      const lines = draft.timeline.phases.map(phase => {
        const duration = phase.durationWeeks ? ` (${phase.durationWeeks} weeks)` : '';
        const activities = Array.isArray(phase.activities) && phase.activities.length ? ` — ${phase.activities.join('; ')}` : '';
        return `${phase.name}${duration}${activities}`;
      });
      if (draft.timeline.targetLaunch) {
        lines.push(`Target launch: ${draft.timeline.targetLaunch}`);
      }
      sections.push({ heading: 'Timeline', lines });
    }

    if (Array.isArray(draft.stakeholders) && draft.stakeholders.length) {
      sections.push({
        heading: 'Stakeholders',
        lines: draft.stakeholders.map(person => {
          const role = person.role ? ` — ${person.role}` : '';
          return `${person.name}${role}`;
        })
      });
    }

    await recordAuditLog(req, 'rfp.export', 'RfpDraft', draft._id.toString(), {
      projectId: draft.projectId ? draft.projectId.toString() : null
    });

    const buffer = createDocx({ title: titleText, sections });
    const filename = `rfp-${draft._id}.docx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    console.error('RFP export failed', err);
    res.status(500).json({ error: 'Unable to export RFP draft' });
  }
});

app.post('/api/assessments/assistant', requireAuth, validateBody(assistantSchema), async (req, res) => {
  try {
    const { message, capabilityId = 'security', draft = {} } = req.validatedBody;
    const capability = getCapability(capabilityId) || CAPABILITY_CATALOG[0];
    const reply = await generateAssessmentAssistantReply({
      message: String(message).slice(0, 800),
      assessmentDraft: draft,
      capability: capability.name
    });
    res.json({ ok: true, ...reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Assistant unavailable' });
  }
});

async function buildAssessmentPayload({ assessment, payload, project, capability, profileIntel }) {
  const normaliseList = value => {
    if (Array.isArray(value)) return value;
    if (!value) return [];
    return String(value)
      .split(/\n|;|\r|\u2022/g)
      .map(item => item.trim())
      .filter(Boolean)
      .slice(0, 12);
  };

  const mergedCompanyProfile = {
    ...(assessment.companyProfile || {}),
    ...(payload.companyProfile || {})
  };

  if (!mergedCompanyProfile.headcount && profileIntel.headcountEstimate) {
    mergedCompanyProfile.headcount = profileIntel.headcountEstimate;
  }
  if (!mergedCompanyProfile.annualRevenue && profileIntel.annualRevenueEstimate) {
    mergedCompanyProfile.annualRevenue = profileIntel.annualRevenueEstimate;
  }
  if (!mergedCompanyProfile.turnover && profileIntel.turnover) {
    mergedCompanyProfile.turnover = profileIntel.turnover;
  }
  mergedCompanyProfile.investmentRounds = normaliseList(
    mergedCompanyProfile.investmentRounds || profileIntel.investmentHighlights
  );
  mergedCompanyProfile.keyInitiatives = normaliseList(
    mergedCompanyProfile.keyInitiatives || (profileIntel.keyInitiatives || []).map(k => `${k.name}: ${k.objective || k.description || ''}`)
  );
  mergedCompanyProfile.organisationStructure = normaliseList(
    mergedCompanyProfile.organisationStructure || (profileIntel.organisationStructure || []).map(o => `${o.function || o.leader}: ${o.remit || ''}`)
  );
  mergedCompanyProfile.discoveryObjectives = normaliseList(
    mergedCompanyProfile.discoveryObjectives || (profileIntel.discoveryObjectives || []).map(d => `${d.objective || ''}${d.linkedKpis ? ` · KPIs: ${Array.isArray(d.linkedKpis) ? d.linkedKpis.join(', ') : d.linkedKpis}` : ''}${d.timeframe ? ` · ${d.timeframe}` : ''}`)
  );
  if (!mergedCompanyProfile.personaKpis && profileIntel.personaKpis) {
    mergedCompanyProfile.personaKpis = profileIntel.personaKpis;
  }

  assessment.companyProfile = mergedCompanyProfile;
  assessment.capabilityFocus = Array.isArray(payload.capabilityFocus) && payload.capabilityFocus.length
    ? payload.capabilityFocus
    : assessment.capabilityFocus?.length
      ? assessment.capabilityFocus
      : project?.capabilityFocus?.length
        ? project.capabilityFocus
        : capability.domains;
  assessment.techLandscape = { ...(project?.techLandscape || {}), ...(assessment.techLandscape || {}), ...(payload.techLandscape || {}) };
  assessment.vendorStrategy = { ...(assessment.vendorStrategy || {}), ...(payload.vendorStrategy || {}) };
  assessment.operatingModel = {
    ...(project?.operatingModel || {}),
    ...(assessment.operatingModel || {}),
    ...(payload.operatingModel || {}),
    discoveryObjectives: payload.operatingModel?.discoveryObjectives || mergedCompanyProfile.discoveryObjectives
  };
  assessment.personas = Array.isArray(payload.personas) && payload.personas.length
    ? payload.personas
    : assessment.personas?.length
      ? assessment.personas
      : project?.personas?.length
        ? project.personas
        : capability.personas;
  assessment.answers = { ...(assessment.answers || {}), ...(payload.answers || {}) };
  assessment.premiumAnswers = { ...(assessment.premiumAnswers || {}), ...(payload.premiumAnswers || {}) };
  assessment.extendedAnswers = { ...(assessment.extendedAnswers || {}), ...(payload.extendedAnswers || {}) };
  assessment.commandAnswers = { ...(assessment.commandAnswers || {}), ...(payload.commandAnswers || {}) };

  const newArchitectureSignals = Object.fromEntries(
    Object.entries(payload.architectureSignals || {}).map(([key, value]) => [key, String(value || '').slice(0, 1000)])
  );
  if (Array.isArray(profileIntel.architectureSignals)) {
    newArchitectureSignals.organisationIntel = profileIntel.architectureSignals.slice(0, 10);
  }
  if (Array.isArray(profileIntel.renewalCalendar)) {
    newArchitectureSignals.renewalCalendar = profileIntel.renewalCalendar.slice(0, 10);
  }
  assessment.architectureSignals = {
    ...(assessment.architectureSignals || {}),
    ...newArchitectureSignals
  };

  if (Array.isArray(payload.initiativeTimeline)) {
    assessment.initiativeTimeline = payload.initiativeTimeline.slice(0, 10).map(item => ({
      title: String(item?.title || '').slice(0, 160),
      owner: String(item?.owner || '').slice(0, 120),
      timeline: String(item?.timeline || '').slice(0, 80),
      outcome: String(item?.outcome || '').slice(0, 200),
      description: String(item?.description || '').slice(0, 240)
    }));
  }

  assessment.architectureUploads = Array.isArray(payload.architectureUploads)
    ? payload.architectureUploads.slice(0, 10)
    : assessment.architectureUploads || [];
  assessment.stakeholderProfile = {
    ...(assessment.stakeholderProfile || {}),
    ...(payload.stakeholderProfile || {})
  };
  assessment.investmentProfile = {
    ...(assessment.investmentProfile || {}),
    ...(payload.investmentProfile || {})
  };
}

async function createAssessment({ userId, project, payload }) {
  const stageMap = { free: 'insight', premium: 'strategic' };
  const requestedStage = stageMap[payload.stage] || payload.stage;
  const allowedStages = ['insight', 'strategic', 'command'];
  const safeStage = allowedStages.includes(requestedStage) ? requestedStage : 'insight';
  const safeVertical = String(payload.vertical || 'generic').toLowerCase();
  const vertical = ['generic', 'saas'].includes(safeVertical) ? safeVertical : 'generic';
  const capability = getCapability(payload.assessmentType || 'security');

  let organizationIntel = {};
  const organization = payload.organization || {};
  if (organization?.name) {
    organizationIntel = await fetchOrganizationIntel({
      organization: organization.name,
      assessmentType: capability.name,
      industry: payload.industry || vertical
    });
  }

  const profileIntel = organizationIntel?.profile || {};

  const assessment = await Assessment.create({
    userId,
    projectId: project._id,
    stage: safeStage,
    assessmentType: capability.id,
    vertical,
    companySize: payload.companySize || 'SMB',
    region: payload.region || 'EMEA',
    industry: payload.industry || '',
    strategicDrivers: Array.isArray(payload.strategicDrivers) ? payload.strategicDrivers : [],
    organization: {
      name: organization?.name || project?.companyProfile?.legalName || '',
      extract:
        organization?.extract ||
        organizationIntel.summary ||
        project?.companyProfile?.summary ||
        '',
      intel: organizationIntel
    },
    companyProfile: {},
    capabilityFocus: Array.isArray(payload.capabilityFocus) ? payload.capabilityFocus : [],
    techLandscape: payload.techLandscape || {},
    personas: Array.isArray(payload.personas) ? payload.personas : [],
    vendorStrategy: payload.vendorStrategy || {},
    operatingModel: payload.operatingModel || {},
    stakeholderProfile: payload.stakeholderProfile || {},
    investmentProfile: payload.investmentProfile || {},
    initiativeTimeline: Array.isArray(payload.initiativeTimeline) ? payload.initiativeTimeline : [],
    architectureUploads: Array.isArray(payload.architectureUploads) ? payload.architectureUploads : [],
    architectureSignals: payload.architectureSignals || {},
    answers: payload.answers || {},
    premiumAnswers: payload.premiumAnswers || {},
    extendedAnswers: payload.extendedAnswers || {},
    commandAnswers: payload.commandAnswers || {},
    projectSnapshot: project.public()
  });

  await buildAssessmentPayload({ assessment, payload, project, capability, profileIntel });
  assessment.projectSnapshot = project.public();
  await assessment.save();

  const reportData = await computeReport({ assessment });
  const report = await Report.findOneAndUpdate(
    { assessmentId: assessment._id, userId },
    {
      ...reportData,
      paid: false,
      assessmentId: assessment._id,
      userId,
      projectId: assessment.projectId
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  await recordMaturityTimepoint({
    projectId: assessment.projectId,
    assessmentId: assessment._id,
    domain: assessment.assessmentType,
    report
  });
  queueProjectAnalyticsRecompute(assessment.projectId);

  return { assessment, report };
}

async function updateAssessment({ assessment, project, payload }) {
  const targetType = payload.nextAssessmentType || assessment.assessmentType;
  const capability = getCapability(targetType);
  assessment.assessmentType = capability.id;

  let organizationIntel = assessment.organization?.intel || {};
  const organization = payload.organization || {};
  if (organization?.name && organization.name !== assessment.organization?.name) {
    organizationIntel = await fetchOrganizationIntel({
      organization: organization.name,
      assessmentType: capability.name,
      industry: assessment.industry || assessment.vertical
    });
  } else if (!organization?.name) {
    organizationIntel = {};
  }

  assessment.stage = 'strategic';
  if (payload.industry) assessment.industry = payload.industry;
  if (payload.companySize) assessment.companySize = payload.companySize;
  if (payload.region) assessment.region = payload.region;
  assessment.strategicDrivers = Array.isArray(payload.strategicDrivers) && payload.strategicDrivers.length
    ? payload.strategicDrivers
    : assessment.strategicDrivers;

  const orgName = organization?.name || '';
  assessment.organization = {
    name: orgName || project?.companyProfile?.legalName || '',
    extract: orgName
      ? organizationIntel.summary || organization?.extract || assessment.organization?.extract || project?.companyProfile?.summary || ''
      : project?.companyProfile?.summary || assessment.organization?.extract || '',
    intel: orgName ? organizationIntel : assessment.organization?.intel || {}
  };

  const profileIntel = organizationIntel?.profile || {};

    await buildAssessmentPayload({ assessment, payload, project, capability, profileIntel });
    assessment.projectSnapshot = project.public();
    await assessment.save();

  const reportData = await computeReport({ assessment });
  const report = await Report.findOneAndUpdate(
    { assessmentId: assessment._id, userId: assessment.userId },
    {
      ...reportData,
      paid: false,
      assessmentId: assessment._id,
      userId: assessment.userId,
      projectId: assessment.projectId
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  await recordMaturityTimepoint({
    projectId: assessment.projectId,
    assessmentId: assessment._id,
    domain: assessment.assessmentType,
    report
  });
  queueProjectAnalyticsRecompute(assessment.projectId);

  return { assessment, report };
}

app.get('/api/projects/:projectId/assessments', requireAuth, requireProjectOwnership('projectId'), async (req, res) => {
  const assessments = await Assessment.find({ userId: req.auth.uid, projectId: req.project._id })
    .sort({ updatedAt: -1 });
  res.json({ ok: true, assessments });
});

app.post(
  '/api/projects/:projectId/assessments',
  requireAuth,
  requireProjectOwnership('projectId'),
  validateBody(assessmentBaseSchema),
  async (req, res) => {
    try {
      const payload = req.validatedBody;
      const { assessment, report } = await createAssessment({
        userId: req.auth.uid,
        project: req.project,
        payload
      });
      res.json({ ok: true, assessmentId: assessment._id, reportId: report._id, stage: report.stage });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

app.get(
  '/api/projects/:projectId/assessments/:assessmentId',
  requireAuth,
  requireProjectOwnership('projectId'),
  async (req, res) => {
    try {
      const assessment = await Assessment.findOne({
        _id: req.params.assessmentId,
        userId: req.auth.uid,
        projectId: req.project._id
      });
      if (!assessment) return res.status(404).json({ error: 'Not found' });
      res.json({ ok: true, assessment, project: req.project.public() });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

app.put(
  '/api/projects/:projectId/assessments/:assessmentId',
  requireAuth,
  requireProjectOwnership('projectId'),
  validateBody(assessmentUpdateSchema),
  async (req, res) => {
    try {
      const assessment = await Assessment.findOne({
        _id: req.params.assessmentId,
        userId: req.auth.uid,
        projectId: req.project._id
      });
      if (!assessment) return res.status(404).json({ error: 'Not found' });
      const { report } = await updateAssessment({
        assessment,
        project: req.project,
        payload: req.validatedBody
      });
      res.json({ ok: true, assessmentId: assessment._id, reportId: report._id, stage: report.stage });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

app.post('/api/assessments', requireAuth, validateBody(assessmentCreateSchema), async (req, res) => {
  try {
    const payload = req.validatedBody;
    if (!payload.projectId) {
      return res.status(400).json({ error: 'A project is required before starting an assessment.' });
    }
    const project = await Project.findOne({ _id: payload.projectId, userId: req.auth.uid });
    if (!project) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { assessment, report } = await createAssessment({
      userId: req.auth.uid,
      project,
      payload
    });
    res.json({ ok: true, assessmentId: assessment._id, reportId: report._id, stage: report.stage });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/assessments/:id', requireAuth, async (req, res) => {
  try {
    const assessment = await Assessment.findOne({ _id: req.params.id, userId: req.auth.uid });
    if (!assessment) return res.status(404).json({ error: 'Not found' });

    const projectDoc = await Project.findOne({ _id: assessment.projectId, userId: req.auth.uid });
    if (!projectDoc) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json({ ok: true, assessment, project: projectDoc.public() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/assessments/:id/premium', requireAuth, validateBody(assessmentUpdateSchema), async (req, res) => {
  try {
    const assessment = await Assessment.findOne({ _id: req.params.id, userId: req.auth.uid });
    if (!assessment) return res.status(404).json({ error: 'Not found' });
    const project = await Project.findOne({ _id: assessment.projectId, userId: req.auth.uid });
    if (!project) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { report } = await updateAssessment({
      assessment,
      project,
      payload: req.validatedBody
    });
    res.json({ ok: true, assessmentId: assessment._id, reportId: report._id, stage: report.stage });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/jobs', requireAuth, jobRouteLimiter, validateBody(jobCreateSchema), async (req, res) => {
  try {
    const { type, payload } = req.validatedBody;
    const jobPayload = { ...(payload || {}), userId: req.auth.uid };
    const job = await Job.create({ type, status: 'pending', payload: jobPayload, attempts: 0 });
    res.status(202).json({ job: serializeJob(job) });
  } catch (err) {
    console.error('Job creation failed', err);
    res.status(500).json({ error: 'Unable to create job' });
  }
});

app.get('/api/jobs/:id', requireAuth, jobRouteLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid job id' });
    }
    const job = await Job.findById(id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    const ownerId = job.payload?.userId ? String(job.payload.userId) : null;
    const isAdmin = await isAdminUser(req.auth.uid);
    if (ownerId && ownerId !== req.auth.uid && !isAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json({ job: serializeJob(job) });
  } catch (err) {
    console.error('Job fetch failed', err);
    res.status(500).json({ error: 'Unable to load job' });
  }
});

app.get('/api/reports/:id', requireAuth, async (req, res) => {
  try {
    const rep = await Report.findOne({ _id: req.params.id, userId: req.auth.uid });
    if (!rep) return res.status(404).json({ error: 'Not found' });
    const info = await loadRequestEntitlement(req, { fallbackPaid: Boolean(rep.paid) });
    const report = sanitizeReportForTier(rep, info.tier);
    res.json({
      ok: true,
      report,
      entitlement: { tier: info.tier, expiresAt: info.record?.expiresAt || null }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to load report' });
  }
});

app.get('/api/reports/:id/export', requireAuth, async (req, res) => {
  try {
    const report = await Report.findOne({ _id: req.params.id, userId: req.auth.uid });
    if (!report) return res.status(404).json({ error: 'Not found' });

    const info = await loadRequestEntitlement(req, { fallbackPaid: Boolean(report.paid) });
    if (!tierAllowsStrategic(info.tier)) {
      return res.status(403).json({ error: 'Upgrade required' });
    }

    await recordAuditLog(req, 'report.export', 'Report', report._id.toString(), {
      stage: report.stage,
      projectId: report.projectId ? report.projectId.toString() : null
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Assessment Summary');
    sheet.columns = [
      { header: 'Metric', key: 'metric', width: 40 },
      { header: 'Value', key: 'value', width: 80 }
    ];

    const summaryData = [
      ['Headline Score', report.headlineScore],
      ['Stage', report.stage],
      ['Vertical', report.vertical],
      ['Assessment Type', report.assessmentType],
      ['Summary', report.summary]
    ];

    summaryData.forEach(([metric, value]) => sheet.addRow({ metric, value }));

    const filename = `assessment-report-${report._id}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to export report' });
  }
});

app.get('/api/reports', requireAuth, async (req, res) => {
  try {
    const reports = await Report.find({ userId: req.auth.uid })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('_id createdAt headlineScore paid vertical')
      .lean();
    const info = await loadRequestEntitlement(req);
    const hydrated = attachAccessToReports(reports, info.tier);
    res.json({
      ok: true,
      reports: hydrated,
      entitlement: { tier: info.tier, expiresAt: info.record?.expiresAt || null }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

function splitCsvLine(line = '') {
  const cells = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function parseNumericCell(value) {
  if (value === undefined || value === null) return undefined;
  const cleaned = String(value).replace(/[$,\s]/g, '');
  if (!cleaned) return undefined;
  const num = Number(cleaned);
  if (!Number.isFinite(num)) {
    throw new Error('Invalid numeric value');
  }
  return num;
}

function parseBusinessMetricsCsv(text) {
  const lines = String(text || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
  if (!lines.length) return [];
  const header = splitCsvLine(lines.shift()).map(cell => cell.toLowerCase());
  const rows = [];
  lines.forEach(line => {
    const cells = splitCsvLine(line);
    if (!cells.length || cells.every(cell => !cell)) return;
    const record = {};
    header.forEach((column, index) => {
      record[column] = cells[index] ?? '';
    });
    const yearRaw = record.year || record.fiscalyear || record.period;
    const year = Number(String(yearRaw).replace(/[^0-9]/g, ''));
    if (!Number.isInteger(year)) {
      throw new Error('Invalid year in CSV');
    }
    const arrUSD = parseNumericCell(record.arrusd || record.arr || record.revenue || record.annualrecurringrevenue);
    const headcount = parseNumericCell(record.headcount || record.fte || record.employees);
    const confidenceRaw = record.sourceconfidence || record.confidence;
    const sourceConfidence = confidenceRaw === undefined || confidenceRaw === '' ? undefined : Number(confidenceRaw);
    if (sourceConfidence !== undefined && ![0, 1, 2].includes(sourceConfidence)) {
      throw new Error('Invalid confidence score');
    }
    rows.push({
      year,
      arrUSD,
      headcount,
      sourceUrl: record.sourceurl || record.url || '',
      sourceConfidence,
      notes: record.notes || record.comment || ''
    });
  });
  return rows;
}

app.post('/api/payments/checkout', requireAuth, validateBody(checkoutSchema), async (req, res) => {
  if (!isStripeConfigured()) {
    return res.status(503).json({ error: 'Payments are not enabled' });
  }
  try {
    const { tier } = req.validatedBody;
    const config = getTierCheckoutConfig(tier);
    const user = await User.findById(req.auth.uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const stripe = getStripe();
    if (isStripeStub()) {
      return res.status(503).json({ error: 'Payments are not enabled in this environment' });
    }
    const payment = await Payment.create({
      userId: user._id,
      amountCents: config.amountCents,
      currency: config.currency,
      provider: 'stripe',
      status: 'pending',
      tier
    });

    const originHost = req.headers.origin || `${req.protocol}://${req.get('host')}`;
    const baseUrl = originHost.replace(/\/$/, '');
    const lineItem = config.priceId
      ? { price: config.priceId, quantity: 1 }
      : {
          price_data: {
            currency: config.currency,
            product_data: { name: config.name },
            unit_amount: config.amountCents
          },
          quantity: 1
        };

    const session = await stripe.checkout.sessions.create({
      mode: config.mode,
      line_items: [lineItem],
      success_url: `${baseUrl}/dashboard.html?checkout=success`,
      cancel_url: `${baseUrl}/dashboard.html?checkout=cancelled`,
      allow_promotion_codes: true,
      customer_email: user.email,
      metadata: {
        userId: user._id.toString(),
        tier,
        paymentId: payment._id.toString()
      }
    });

    payment.stripeSessionId = session.id;
    payment.metadata = { ...(payment.metadata || {}), checkoutMode: config.mode };
    if (session.amount_total) payment.amountCents = session.amount_total;
    if (session.currency) payment.currency = session.currency;
    await payment.save();

    res.json({ ok: true, checkoutUrl: session.url, sessionId: session.id });
  } catch (err) {
    console.error('Checkout session creation failed', err);
    res.status(500).json({ error: 'Unable to initiate checkout' });
  }
});

app.post('/api/payments/webhook', async (req, res) => {
  if (!isStripeConfigured() || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).json({ error: 'Webhook not configured' });
  }
  const signature = req.headers['stripe-signature'];
  if (!signature || !req.rawBody) {
    return res.status(400).json({ error: 'Invalid signature' });
  }

  let event;
  try {
    event = getStripe().webhooks.constructEvent(req.rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Stripe signature verification failed', err);
    return res.status(400).json({ error: 'Signature verification failed' });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const metadata = session.metadata || {};
        const paymentId = metadata.paymentId;
        let payment = null;
        if (paymentId && mongoose.Types.ObjectId.isValid(paymentId)) {
          payment = await Payment.findById(paymentId);
        }
        if (!payment && session.id) {
          payment = await Payment.findOne({ stripeSessionId: session.id });
        }
        if (payment) {
          payment.status = 'paid';
          payment.stripeSessionId = session.id;
          payment.metadata = { ...(payment.metadata || {}), ...metadata };
          if (session.amount_total) payment.amountCents = session.amount_total;
          if (session.currency) payment.currency = session.currency;
          await payment.save();
        }
        const userId = payment?.userId || metadata.userId;
        const tier = metadata.tier || payment?.tier;
        if (userId && tier) {
          let expiresAt = null;
          if (session.mode === 'subscription' && session.subscription) {
            try {
              const subscription = await getStripe().subscriptions.retrieve(session.subscription);
              if (subscription?.current_period_end) {
                expiresAt = new Date(subscription.current_period_end * 1000);
              }
            } catch (err) {
              console.error('Unable to retrieve subscription period', err);
            }
          }
          await grantEntitlement({ userId, tier, expiresAt });
        }
        break;
      }
      case 'checkout.session.expired': {
        const session = event.data.object;
        if (session?.id) {
          await Payment.findOneAndUpdate({ stripeSessionId: session.id }, { status: 'failed' });
        }
        break;
      }
      default:
        break;
    }
    res.json({ received: true });
  } catch (err) {
    console.error('Stripe webhook handling failed', err);
    res.status(500).json({ error: 'Webhook handling failed' });
  }
});

app.post(
  '/api/admin/entitlements/grant',
  requireAuth,
  validateBody(entitlementGrantSchema),
  async (req, res) => {
    try {
      if (!(await isAdminUser(req.auth.uid))) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const { userId, tier, expiresAt } = req.validatedBody;
      if (tier === 'free') {
        await Entitlement.deleteMany({ userId });
        return res.json({ ok: true, entitlement: { tier: 'free', expiresAt: null } });
      }
      let expiry = null;
      if (expiresAt) {
        const parsed = new Date(expiresAt);
        if (Number.isNaN(parsed.getTime())) {
          return res.status(400).json({ error: 'Invalid expiresAt value' });
        }
        expiry = parsed;
      }
      const entitlement = await grantEntitlement({ userId, tier, expiresAt: expiry });
      res.json({
        ok: true,
        entitlement: { tier: entitlement.tier, expiresAt: entitlement.expiresAt || null }
      });
    } catch (err) {
      console.error('Admin entitlement grant failed', err);
      res.status(500).json({ error: 'Unable to grant entitlement' });
    }
  }
);

const JOB_WORKER_INTERVAL_MS = parseInt(process.env.JOB_WORKER_INTERVAL_MS || '10000', 10);
const JOB_WORKER_CONCURRENCY = Math.min(
  Math.max(parseInt(process.env.JOB_WORKER_CONCURRENCY || '1', 10) || 1, 1),
  2
);
const JOB_MAX_ATTEMPTS = parseInt(process.env.JOB_MAX_ATTEMPTS || '3', 10);
const WORKER_ID = `worker-${process.pid}`;
let activeJobCount = 0;

async function processPersonaBriefsJob(job) {
  const { assessmentId, reportId, userId } = job.payload || {};
  if (!assessmentId) throw new Error('assessmentId is required');
  const query = { _id: assessmentId };
  if (userId) query.userId = userId;
  const assessment = await Assessment.findOne(query);
  if (!assessment) throw new Error('Assessment not found');
  const reportData = await computeReport({ assessment });
  if (reportId) {
    await Report.findOneAndUpdate(
      { _id: reportId, userId: userId || assessment.userId },
      { personaBriefings: reportData.personaBriefings },
      { new: false }
    );
  }
  return { personaBriefings: reportData.personaBriefings || [] };
}

async function processExecNarrativeJob(job) {
  const { reportId, assessmentId, userId } = job.payload || {};
  let report = null;
  if (reportId) {
    const reportQuery = { _id: reportId };
    if (userId) reportQuery.userId = userId;
    report = await Report.findOne(reportQuery);
  }
  let assessment;
  if (report) {
    assessment = await Assessment.findById(report.assessmentId);
  } else if (assessmentId) {
    const query = { _id: assessmentId };
    if (userId) query.userId = userId;
    assessment = await Assessment.findOne(query);
  }
  if (!assessment) throw new Error('Assessment not found');
  const reportData = await computeReport({ assessment });
  if (report) {
    report.aiNarrative = reportData.aiNarrative;
    report.evidence = reportData.evidence || report.evidence;
    await report.save();
  }
  return { aiNarrative: reportData.aiNarrative || {} };
}

async function runJob(job) {
  switch (job.type) {
    case 'persona-briefs':
      return processPersonaBriefsJob(job);
    case 'exec-narrative':
      return processExecNarrativeJob(job);
    default:
      throw new Error(`Unsupported job type: ${job.type}`);
  }
}

async function runJobWorkerTick() {
  if (activeJobCount >= JOB_WORKER_CONCURRENCY) return;
  const job = await Job.findOneAndUpdate(
    { status: 'pending' },
    { $set: { status: 'running', workerId: WORKER_ID }, $inc: { attempts: 1 } },
    { sort: { createdAt: 1 }, new: true }
  );
  if (!job) return;
  activeJobCount += 1;
  try {
    const result = await runJob(job);
    await Job.findByIdAndUpdate(job._id, {
      status: 'done',
      result,
      workerId: WORKER_ID,
      error: null
    });
  } catch (err) {
    console.error('Job execution failed', err);
    const attempts = job.attempts || 0;
    const status = attempts >= JOB_MAX_ATTEMPTS ? 'error' : 'pending';
    await Job.findByIdAndUpdate(job._id, {
      status,
      error: err.message || 'Job failed',
      workerId: WORKER_ID
    });
  } finally {
    activeJobCount -= 1;
  }
}

if (String(process.env.RUN_WORKER || '').toLowerCase() === 'true') {
  setInterval(runJobWorkerTick, JOB_WORKER_INTERVAL_MS);
  runJobWorkerTick();
}

app.use((err, req, res, next) => {
  if (err && err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File too large' });
    }
    return res.status(400).json({ error: 'File upload error', details: err.message });
  }
  return next(err);
});

const PUBLIC_DIR = path.join(__dirname, 'public');
app.use(express.static(PUBLIC_DIR));

app.get('*', (req, res) => {
  const p = path.join(PUBLIC_DIR, 'index.html');
  res.sendFile(p);
});

const port = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(port, () => {
    console.log('🚀 Agama Technologies backend running on port', port);
  });
}

module.exports = app;
module.exports.ensureMongoConnection = ensureMongoConnection;
