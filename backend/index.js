require('dotenv').config();
const path = require('path');
const fs = require('fs');
const fsPromises = fs.promises;
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const { WorkOS } = require('@workos-inc/node');

const { requireAuth, issueTokenCookie, clearTokenCookie } = require('./middleware/auth');
const { validateBody } = require('./middleware/validation');
const User = require('./models/User');
const AdminConfig = require('./models/AdminConfig');
const ProcurementVendor = require('./models/ProcurementVendor');
const BuyerValueAssessment = require('./models/BuyerValueAssessment');
const RevenueAccount = require('./models/RevenueAccount');
const Organization = require('./models/Organization');
const OrganizationMembership = require('./models/OrganizationMembership');
const EngagementRoom = require('./models/EngagementRoom');
const EngagementRoomMembership = require('./models/EngagementRoomMembership');
const EngagementRoomInvite = require('./models/EngagementRoomInvite');
const EngagementRoomIssue = require('./models/EngagementRoomIssue');
const EngagementRoomIssueComment = require('./models/EngagementRoomIssueComment');
const EngagementRoomDeliverable = require('./models/EngagementRoomDeliverable');
const EngagementRoomMessage = require('./models/EngagementRoomMessage');
const EngagementRoomFile = require('./models/EngagementRoomFile');
const EngagementRoomFileVersion = require('./models/EngagementRoomFileVersion');
const EngagementRoomFileComment = require('./models/EngagementRoomFileComment');
const AuditEvent = require('./models/AuditEvent');
const { requireOrgRole } = require('./middleware/orgAuth');

const app = express();
app.set('trust proxy', 1);
const isProduction = process.env.NODE_ENV === 'production';
const APP_BASE_URL = (process.env.APP_BASE_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000').replace(/\/$/, '');
const WORKOS_LOGOUT_REDIRECT = process.env.WORKOS_LOGOUT_REDIRECT || 'https://www.agamatechnologies.com';
const workosClient = process.env.WORKOS_API_KEY ? new WorkOS(process.env.WORKOS_API_KEY) : null;
const WORKOS_CLIENT_ID = process.env.WORKOS_CLIENT_ID;
const WORKOS_REDIRECT_URI = process.env.WORKOS_REDIRECT_URI;
const WORKOS_SUCCESS_REDIRECT = process.env.WORKOS_SUCCESS_REDIRECT || '/workspace.html';
const WORKOS_STATE_COOKIE = 'workos_auth_state';
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

async function purgeUserOwnedData(user) {
  const userId = user._id;
  const email = (user.email || '').toLowerCase();
  await Promise.all([
    OrganizationMembership.deleteMany({ user: userId }),
    EngagementRoomMembership.deleteMany({ user: userId }),
    EngagementRoomInvite.deleteMany({ invitedBy: userId }),
    email ? EngagementRoomInvite.deleteMany({ email }) : Promise.resolve(),
    EngagementRoomMessage.deleteMany({ author: userId }),
    EngagementRoomFile.deleteMany({ createdBy: userId }),
    EngagementRoomFileVersion.deleteMany({ uploadedBy: userId }),
    EngagementRoomFileComment.deleteMany({ author: userId }),
    EngagementRoomDeliverable.deleteMany({ owner: userId }),
    EngagementRoomDeliverable.deleteMany({ createdBy: userId }),
    EngagementRoomIssue.deleteMany({ createdBy: userId }),
    EngagementRoomIssueComment.deleteMany({ author: userId }),
    AuditEvent.deleteMany({ actorUser: userId }),
    AuditEvent.deleteMany({ targetUser: userId }),
    RevenueAccount.deleteMany({ userId }),
    ProcurementVendor.deleteMany({ userId })
  ]);
}

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

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

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
const LICENSE_OPTIONS = ['personal', 'business', 'guest'];
const LICENSE_PLANS = ['free-personal', 'vendor-enterprise', 'procurement-enterprise', 'consulting-enterprise'];
const FREE_ASSESSMENT_LIMIT = 3;

function computeAssessmentLimit(user) {
  if (!user) return null;
  if (user.licenseTier === 'personal') return user.valueAssessmentLimit || FREE_ASSESSMENT_LIMIT;
  return null;
}

function storeWorkOSState(res) {
  const value = crypto.randomBytes(24).toString('hex');
  res.cookie(WORKOS_STATE_COOKIE, value, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000,
    path: '/api/auth'
  });
  return value;
}

function consumeWorkOSState(req, res) {
  const value = req.cookies?.[WORKOS_STATE_COOKIE];
  res.clearCookie(WORKOS_STATE_COOKIE, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/api/auth'
  });
  return value;
}

function resolveWorkOSSuccessRedirect(req) {
  const target = WORKOS_SUCCESS_REDIRECT || '/';
  if (/^https?:\/\//i.test(target)) return target;

  const origin = APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
  if (target.startsWith('/')) {
    return `${origin}${target}`;
  }
  return `${origin}/${target}`;
}

function resolveWorkOSRedirectUri(req) {
  if (WORKOS_REDIRECT_URI) return WORKOS_REDIRECT_URI;
  const origin = APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
  return `${origin}/api/auth/workos/callback`;
}

function computeEffectiveLicense(user, organizationContext) {
  if (!user) return { tier: 'guest', homeOrg: null };
  if (user.licenseTier === 'guest') return { tier: 'guest', homeOrg: null };

  if (user.licenseTier === 'business' && organizationContext && organizationContext.tier === 'business') {
    const { id, name, tier, orgType, role } = organizationContext;
    return { tier: 'business', homeOrg: { id, name, tier, orgType, role } };
  }

  return { tier: 'personal', homeOrg: null };
}

function recommendLicensePlan(persona, goals = []) {
  if (persona === 'consultant') return 'consulting-enterprise';
  if (persona === 'vendor' || persona === 'both') return 'vendor-enterprise';
  if (persona === 'buyer') return 'procurement-enterprise';
  if (Array.isArray(goals) && goals.some(goal => /consult/i.test(goal))) return 'consulting-enterprise';
  return 'free-personal';
}

function applyLicenseSelection(user, selection) {
  const chosen = LICENSE_PLANS.includes(selection) ? selection : 'free-personal';
  user.licensePlan = chosen;
  if (chosen === 'free-personal') {
    user.licenseTier = 'personal';
    user.valueAssessmentLimit = FREE_ASSESSMENT_LIMIT;
    user.platformAccess = ['valuesphere'];
    return;
  }

  user.licenseTier = 'business';
  user.valueAssessmentLimit = null;
  const desiredPlatforms = user.platformAccess && user.platformAccess.length ? user.platformAccess : Array.from(PLATFORM_IDS);
  const normalised = normalisePlatformAccess(user.licenseTier, desiredPlatforms);
  user.platformAccess = normalised.error ? Array.from(PLATFORM_IDS) : normalised.platformAccess;
}

const AGAMA_ADMIN_UNLOCK_COOKIE = 'agama_admin_unlocked';
const AGAMA_ADMIN_UNLOCK_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours per session

function isAgamaStaff(user) {
  if (!user) return false;
  const email = (user.email || '').toLowerCase();
  return user.isStaff === true && email.endsWith('@agamatechnologies.com');
}

async function requireAgamaStaff(req, res, next) {
  try {
    const user = req.requestingUser || (req.auth?.uid ? await User.findById(req.auth.uid) : null);
    if (!isAgamaStaff(user)) {
      return res.status(403).json({ error: 'AGAMA_STAFF_ONLY' });
    }
    req.requestingUser = user;
    return next();
  } catch (err) {
    console.error('Agama staff check failed', err);
    return res.status(500).json({ error: 'Unable to verify staff access' });
  }
}

// Simple session-level flag: a short-lived, httpOnly cookie marks the admin console as unlocked.
function requireAdminConsoleUnlocked(req, res, next) {
  const unlocked = req.cookies?.[AGAMA_ADMIN_UNLOCK_COOKIE] === 'true';
  if (!unlocked) {
    return res.status(403).json({ error: 'ADMIN_CONSOLE_LOCKED' });
  }
  return next();
}

async function recordAuditEvent({
  type,
  actorUser,
  actorOrganization = null,
  targetUser = null,
  targetOrganization = null,
  targetRoom = null,
  metadata = {}
}) {
  try {
    if (!type || !actorUser) return null;
    return await AuditEvent.create({
      type,
      actorUser,
      actorOrganization,
      targetUser,
      targetOrganization,
      targetRoom,
      metadata
    });
  } catch (err) {
    console.error('Audit log failed', err);
    return null;
  }
}

function serializeAuditEvent(event) {
  const toUserPayload = user =>
    user
      ? {
          id: user._id ? user._id.toString() : String(user),
          name: user.name || '',
          email: user.email || ''
        }
      : null;
  const toOrgPayload = org =>
    org
      ? {
          id: org._id ? org._id.toString() : String(org),
          name: org.name || '',
          slug: org.slug || ''
        }
      : null;

  return {
    id: event._id ? event._id.toString() : undefined,
    type: event.type,
    createdAt: event.createdAt,
    actorUser: toUserPayload(event.actorUser),
    actorOrganization: toOrgPayload(event.actorOrganization),
    targetUser: toUserPayload(event.targetUser),
    targetOrganization: toOrgPayload(event.targetOrganization),
    targetRoom: event.targetRoom ? (event.targetRoom._id ? event.targetRoom._id.toString() : String(event.targetRoom)) : null,
    metadata: event.metadata || {}
  };
}

function getPlatformEntitlement(user, organizationContext, platformId) {
  const platform = PLATFORM_DEFINITIONS.find(p => p.id === platformId);
  const effectiveLicense = computeEffectiveLicense(user, organizationContext);
  const userPlatforms = Array.isArray(user?.platformAccess) ? user.platformAccess : [];

  if (!platform) {
    return { allowed: false, reason: 'unknown_platform', effectiveLicense };
  }

  if (effectiveLicense.tier === 'guest') {
    return { allowed: false, reason: 'guest_only', effectiveLicense };
  }

  const hasPlatform = userPlatforms.includes(platformId);
  const requiresBusiness = platform.requiresBusinessLicense === true;
  const isBusiness = effectiveLicense.tier === 'business';

  if (!hasPlatform) {
    return { allowed: false, reason: 'not_purchased', effectiveLicense };
  }

  if (requiresBusiness && !isBusiness) {
    return { allowed: false, reason: 'requires_business', effectiveLicense };
  }

  if (
    platform.requiredOrgType &&
    organizationContext &&
    organizationContext.orgType &&
    platform.requiredOrgType !== organizationContext.orgType
  ) {
    return { allowed: false, reason: 'wrong_org_type', effectiveLicense };
  }

  return { allowed: true, reason: 'ok', effectiveLicense };
}

async function buildOrganizationContext(user, orgId, { includeSeatDetails = false } = {}) {
  if (!user || !orgId) return null;
  const organization = await Organization.findById(orgId);
  if (!organization) return null;
  const membership = await OrganizationMembership.findOne({ organization: orgId, user: user._id, status: 'active' });
  if (!membership) return null;

  const context = {
    id: organization._id.toString(),
    name: organization.name,
    slug: organization.slug,
    tier: organization.tier,
    orgType: organization.orgType || 'both',
    role: membership.role
  };

  if (includeSeatDetails) {
    context.seatLimit = organization.seatLimit;
    context.seatsUsed = await OrganizationMembership.countActiveSeats(organization._id);
  }

  return context;
}

function requirePlatformAccess(platformId) {
  return async function(req, res, next) {
    try {
      if (!req.auth || !req.auth.uid) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const user = req.requestingUser || (await User.findById(req.auth.uid));
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const orgId = req.auth.orgId || user.defaultOrganization;
      const organizationContext = await buildOrganizationContext(user, orgId);
      const entitlement = getPlatformEntitlement(user, organizationContext, platformId);

      if (!entitlement.allowed) {
        return res
          .status(403)
          .json({ error: 'PLATFORM_ACCESS_DENIED', platformId, reason: entitlement.reason });
      }

      req.requestingUser = user;
      req.organizationContext = organizationContext;
      req.platformEntitlement = entitlement;

      return next();
    } catch (err) {
      console.error('Platform access middleware error', err);
      return res.status(500).json({ error: 'Unable to verify platform access' });
    }
  };
}

async function requireStaff(req, res, next) {
  try {
    if (!req.auth || !req.auth.uid) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = req.requestingUser || (await User.findById(req.auth.uid));
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.isStaff !== true) {
      return res.status(403).json({ error: 'STAFF_ONLY' });
    }

    req.requestingUser = user;
    return next();
  } catch (err) {
    console.error('requireStaff error', err);
    return res.status(500).json({ error: 'Unable to verify staff access' });
  }
}

async function requireOrgAdmin(req, res, next) {
  try {
    if (!req.auth || !req.auth.uid) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = req.requestingUser || (await User.findById(req.auth.uid));
    if (!user) return res.status(404).json({ error: 'User not found' });

    const orgId = req.auth.orgId || user.defaultOrganization;
    if (!orgId) {
      return res.status(400).json({ error: 'ORG_NOT_SELECTED' });
    }

    const organization = await Organization.findById(orgId);
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const membership = await OrganizationMembership.findOne({
      organization: orgId,
      user: user._id,
      status: 'active'
    });

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return res.status(403).json({ error: 'ORG_ADMIN_ONLY' });
    }

    req.requestingUser = user;
    req.organization = organization;
    req.orgMembership = membership;
    return next();
  } catch (err) {
    console.error('requireOrgAdmin error', err);
    return res.status(500).json({ error: 'Unable to verify organization admin access' });
  }
}

function normalisePlatformAccess(licenseTier, requested) {
  if (!LICENSE_OPTIONS.includes(licenseTier)) {
    return { error: 'Unknown license tier.' };
  }
  const selections = Array.isArray(requested)
    ? Array.from(new Set(requested.map(value => String(value))))
    : [];

  if (licenseTier === 'guest') {
    return { platformAccess: ['valuesphere'] };
  }

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

function normaliseProductAccess(requested) {
  const selections = Array.isArray(requested)
    ? Array.from(new Set(requested.map(value => String(value))))
    : [];
  return selections.filter(id => PLATFORM_IDS.has(id));
}

async function generateUniqueOrgSlug(baseValue) {
  const baseSlug = String(baseValue || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 60);

  let slug = baseSlug || `org-${Date.now()}`;
  let suffix = 1;
  while (await Organization.findOne({ slug })) {
    slug = `${baseSlug || `org-${Date.now()}`}-${suffix++}`;
  }
  return slug;
}

const signupSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(8),
  company: z.string().trim().max(160).optional(),
  role: z.string().trim().max(160).optional(),
  industry: z.string().trim().max(160).optional(),
  licenseTier: z.enum(LICENSE_OPTIONS).default('personal'),
  platformAccess: z.array(z.string()).optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

const adminUnlockSchema = z.object({
  secret: z.string().min(1)
});

const personaUpdateSchema = z.object({
  persona: z.enum(['vendor', 'buyer', 'both', 'explorer', 'unknown', 'consultant'])
});

const valuesphereModeUpdateSchema = z.object({
  mode: z.enum(['vendor', 'buyer'])
});

const onboardingSchema = z.object({
  persona: z.enum(['vendor', 'buyer', 'both', 'explorer', 'unknown', 'consultant']).optional(),
  usage: z.array(z.enum(['assessments', 'procurement', 'gtm'])).optional(),
  goals: z.array(z.string().trim().max(200)).optional(),
  intent: z.string().trim().max(400).optional(),
  useCases: z.array(z.string().trim().max(200)).optional(),
  organizationType: z.enum(['vendor', 'buyer', 'both', 'consultant']).optional(),
  recommendation: z.enum(LICENSE_PLANS).optional(),
  licenseSelection: z.enum(LICENSE_PLANS).optional(),
  billingDetails: z
    .object({
      billingName: z.preprocess(
        val => (typeof val === 'string' && val.trim() === '' ? undefined : val),
        z.string().trim().max(200).optional()
      ),
      company: z.string().trim().max(200).optional(),
      email: z.preprocess(
        val => (typeof val === 'string' && val.trim() === '' ? undefined : val),
        z.string().email().optional()
      ),
      notes: z.preprocess(
        val => (typeof val === 'string' && val.trim() === '' ? undefined : val),
        z.string().trim().max(400).optional()
      )
    })
    .optional(),
  status: z.enum(['pending', 'in-progress', 'completed']).optional()
});

const profileUpdateSchema = z.object({
  name: z.string().trim().max(120).optional(),
  company: z.string().trim().max(160).optional(),
  role: z.string().trim().max(160).optional(),
  industry: z.string().trim().max(160).optional(),
  licenseTier: z.enum(LICENSE_OPTIONS).optional(),
  platformAccess: z.array(z.string()).optional()
});

const organizationCreateSchema = z.object({
  name: z.string().trim().min(2),
  slug: z.string().trim().min(2),
  orgType: z.enum(['vendor', 'buyer', 'both']).optional(),
  tier: z.enum(['personal', 'business']).optional(),
  productAccess: z.array(z.string().trim()).optional(),
  domains: z.array(z.string().trim()).optional(),
  workosOrganizationId: z.string().trim().optional(),
  seatLimit: z.number().int().positive().max(100000).optional(),
  platformAccess: z.array(z.string()).optional()
});

const organizationUpdateSchema = z.object({
  name: z.string().trim().min(2).optional(),
  orgType: z.enum(['vendor', 'buyer', 'both']).optional(),
  tier: z.enum(['personal', 'business']).optional(),
  productAccess: z.array(z.string().trim()).optional(),
  domains: z.array(z.string().trim()).optional(),
  workosOrganizationId: z.string().trim().optional(),
  seatLimit: z.number().int().positive().max(100000).optional(),
  platformAccess: z.array(z.string()).optional()
});

const adminOrganizationCreateSchema = z
  .object({
    name: z.string().trim().min(2),
    orgType: z.enum(['vendor', 'buyer', 'both']).default('both'),
    tier: z.enum(['personal', 'business']).default('business'),
    productAccess: z.array(z.string()).default([]),
    seatLimit: z.number().int().positive().max(100000).default(10),
    domains: z.array(z.string().trim()).default([]),
    workosOrganizationId: z.string().trim().optional()
  })
  .refine(payload => payload.productAccess.every(id => PLATFORM_IDS.has(id)), {
    message: 'Invalid product access selection',
    path: ['productAccess']
  });

const adminOrganizationUpdateSchema = z
  .object({
    name: z.string().trim().min(2).optional(),
    orgType: z.enum(['vendor', 'buyer', 'both']).optional(),
    tier: z.enum(['personal', 'business']).optional(),
    productAccess: z.array(z.string()).optional(),
    seatLimit: z.number().int().positive().max(100000).optional(),
    domains: z.array(z.string().trim()).optional(),
    workosOrganizationId: z.string().trim().optional()
  })
  .refine(payload => !payload.productAccess || payload.productAccess.every(id => PLATFORM_IDS.has(id)), {
    message: 'Invalid product access selection',
    path: ['productAccess']
  });

const membershipUpdateSchema = z.object({
  role: z.enum(['owner', 'admin', 'member', 'viewer']).optional(),
  status: z.enum(['active', 'invited', 'suspended', 'removed']).optional()
});

const membershipCreateSchema = z.object({
  email: z.string().email(),
  role: z.enum(['owner', 'admin', 'member', 'viewer']).default('member')
});

const objectIdPattern = /^[a-fA-F0-9]{24}$/;

const roomCreateSchema = z.object({
  title: z.string().trim().min(1),
  vendorOrg: z.string().regex(objectIdPattern),
  buyerOrg: z.string().regex(objectIdPattern),
  revenueAccount: z.string().regex(objectIdPattern).optional(),
  procurementVendor: z.string().regex(objectIdPattern).optional()
});

const issueCreateSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().optional(),
  status: z.enum(['not_started', 'in_progress', 'completed', 'stuck']).optional(),
  assignees: z.array(z.string().regex(objectIdPattern)).optional(),
  dueDate: z.coerce.date().optional(),
  notes: z.string().trim().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional()
});

function serializeMembership(membership) {
  const user = membership.user || {};
  const userId = typeof membership.user === 'string' ? membership.user : user._id;
  const allowedStatuses = new Set(['invited', 'active', 'suspended', 'removed']);
  const status = allowedStatuses.has(membership.status) ? membership.status : 'active';
  return {
    id: membership._id.toString(),
    userId: userId ? userId.toString() : null,
    name: user.name || null,
    email: user.email || membership.invitedEmail || null,
    role: membership.role,
    status,
    licenseTier: user.licenseTier || null,
    lastLoginAt: user.lastLoginAt || null,
    createdAt: membership.createdAt
  };
}

const issueUpdateSchema = z.object({
  title: z.string().trim().min(1).optional(),
  description: z.string().trim().optional(),
  status: z.enum(['not_started', 'in_progress', 'completed', 'stuck']).optional(),
  assignees: z.array(z.string().regex(objectIdPattern)).optional(),
  dueDate: z.coerce.date().optional(),
  notes: z.string().trim().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional()
});

const messageCreateSchema = z.object({
  body: z.string().trim().min(1),
  type: z.enum(['message', 'system', 'ai_summary']).optional(),
  metadata: z.record(z.any()).optional()
});

const deliverableCreateSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().optional(),
  status: z.enum(['not_started', 'in_progress', 'completed', 'at_risk']).optional(),
  owner: z.string().regex(objectIdPattern),
  relatedIssues: z.array(z.string().regex(objectIdPattern)).optional(),
  dueDate: z.coerce.date().optional()
});

const deliverableUpdateSchema = z.object({
  title: z.string().trim().min(1).optional(),
  description: z.string().trim().optional(),
  status: z.enum(['not_started', 'in_progress', 'completed', 'at_risk']).optional(),
  owner: z.string().regex(objectIdPattern).optional(),
  relatedIssues: z.array(z.string().regex(objectIdPattern)).optional(),
  dueDate: z.coerce.date().optional()
});

const issueCommentCreateSchema = z.object({
  body: z.string().trim().min(1)
});

const fileCreateSchema = z
  .object({
    name: z.string().trim().min(1),
    mimeType: z.string().trim().min(1),
    sizeBytes: z.number().int().positive(),
    storageKey: z.string().trim().optional(),
    base64: z.string().trim().optional()
  })
  .refine(payload => payload.storageKey || payload.base64, {
    message: 'storageKey or base64 is required for file uploads'
  });

const fileCommentSchema = z.object({
  body: z.string().trim().min(1),
  version: z.string().regex(objectIdPattern).optional()
});

const fileValidationSchema = z.object({
  version: z.string().regex(objectIdPattern).optional(),
  context: z.string().trim().optional()
});

const aiSummarySchema = z.object({
  timeWindowHours: z.number().int().positive().max(720).default(24)
});

const aiStatusReportSchema = z.object({
  audience: z.enum(['internal', 'customer', 'joint']).default('joint')
});

const aiIssuesGroomingSchema = z.object({
  focus: z.string().trim().optional(),
  limit: z.number().int().positive().max(50).optional()
});

const aiRenewalInsightsSchema = z.object({
  segment: z.string().trim().optional()
});

const roomMembershipCreateSchema = z.object({
  userId: z.string().regex(objectIdPattern),
  organization: z.string().regex(objectIdPattern),
  role: z.enum(['room_admin', 'editor', 'viewer'])
});

const roomInviteCreateSchema = z.object({
  email: z.string().trim().email(),
  organization: z.string().regex(objectIdPattern),
  role: z.enum(['room_admin', 'editor', 'viewer']),
  isGuestInvite: z.boolean().optional()
});

const ROOM_ROLE_ORDER = ['viewer', 'editor', 'room_admin'];

function isValidObjectId(value) {
  return objectIdPattern.test(String(value || ''));
}

function hasRoomRole(membership, minRole) {
  if (!membership) return false;
  const current = ROOM_ROLE_ORDER.indexOf(membership.role || 'viewer');
  const required = ROOM_ROLE_ORDER.indexOf(minRole);
  return current >= required;
}

function isRoomOrganization(room, orgId) {
  if (!room || !orgId) return false;
  const value = String(orgId);
  return (
    (room.vendorOrg && room.vendorOrg.toString() === value) || (room.buyerOrg && room.buyerOrg.toString() === value)
  );
}

async function findActiveOrgMembership(userId, orgId) {
  if (!orgId) return null;
  return OrganizationMembership.findOne({ organization: orgId, user: userId, status: 'active' });
}

async function loadRoomWithMembership(roomId, userId) {
  if (!isValidObjectId(roomId)) return { room: null, membership: null };
  const membership = await EngagementRoomMembership.findOne({ room: roomId, user: userId }).populate(
    'organization',
    'name orgType tier'
  );
  if (!membership) return { room: null, membership: null };
  const room = await EngagementRoom.findById(roomId);
  return { room, membership };
}

function serializeRoom(room, membership) {
  if (!room) return null;
  const membershipOrg = membership?.organization;
  const orgDetails = membershipOrg
    ? {
        id: membershipOrg._id ? membershipOrg._id.toString() : membershipOrg.toString(),
        name: membershipOrg.name || null,
        orgType: membershipOrg.orgType || null,
        tier: membershipOrg.tier || null
      }
    : null;

  return {
    id: room._id.toString(),
    title: room.title,
    status: room.status,
    vendorOrg: room.vendorOrg ? room.vendorOrg.toString() : null,
    buyerOrg: room.buyerOrg ? room.buyerOrg.toString() : null,
    revenueAccount: room.revenueAccount ? room.revenueAccount.toString() : null,
    procurementVendor: room.procurementVendor ? room.procurementVendor.toString() : null,
    lastActivityAt: room.lastActivityAt,
    membership: membership
      ? {
          role: membership.role,
          organization: membership.organization
            ? membership.organization._id
              ? membership.organization._id.toString()
              : membership.organization.toString()
            : null
        }
      : null,
    yourMembership: membership
      ? {
          role: membership.role,
          isGuest: Boolean(membership.isGuest),
          organization: orgDetails
        }
      : null
  };
}

function serializeIssue(issue) {
  return {
    id: issue._id.toString(),
    room: issue.room ? issue.room.toString() : null,
    title: issue.title,
    description: issue.description || null,
    status: issue.status,
    assignees: Array.isArray(issue.assignees) ? issue.assignees.map(id => id.toString()) : [],
    dueDate: issue.dueDate || null,
    notes: issue.notes || null,
    priority: issue.priority || null,
    createdBy: issue.createdBy ? issue.createdBy.toString() : null,
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt
  };
}

function serializeMessage(message) {
  return {
    id: message._id.toString(),
    room: message.room ? message.room.toString() : null,
    author: message.author ? message.author.toString() : null,
    body: message.body,
    type: message.type || 'message',
    metadata: message.metadata || {},
    createdAt: message.createdAt,
    updatedAt: message.updatedAt
  };
}

function serializeDeliverable(deliverable) {
  return {
    id: deliverable._id.toString(),
    room: deliverable.room ? deliverable.room.toString() : null,
    title: deliverable.title,
    description: deliverable.description || null,
    status: deliverable.status,
    owner: deliverable.owner ? deliverable.owner.toString() : null,
    relatedIssues: Array.isArray(deliverable.relatedIssues)
      ? deliverable.relatedIssues.map(id => id.toString())
      : [],
    dueDate: deliverable.dueDate || null,
    createdBy: deliverable.createdBy ? deliverable.createdBy.toString() : null,
    createdAt: deliverable.createdAt,
    updatedAt: deliverable.updatedAt
  };
}

function serializeIssueComment(comment) {
  return {
    id: comment._id.toString(),
    room: comment.room ? comment.room.toString() : null,
    issue: comment.issue ? comment.issue.toString() : null,
    author: comment.author ? comment.author.toString() : null,
    body: comment.body,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt
  };
}

function serializeFileVersion(version) {
  return {
    id: version._id.toString(),
    file: version.file ? version.file.toString() : null,
    storageKey: version.storageKey,
    sizeBytes: version.sizeBytes,
    uploadedBy: version.uploadedBy ? version.uploadedBy.toString() : null,
    uploadedAt: version.uploadedAt || version.createdAt,
    createdAt: version.createdAt,
    updatedAt: version.updatedAt
  };
}

function serializeFile(file, currentVersion) {
  return {
    id: file._id.toString(),
    room: file.room ? file.room.toString() : null,
    name: file.name,
    mimeType: file.mimeType,
    currentVersion: currentVersion ? serializeFileVersion(currentVersion) : file.currentVersion?.toString?.(),
    createdBy: file.createdBy ? file.createdBy.toString() : null,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt
  };
}

function serializeFileComment(comment) {
  return {
    id: comment._id.toString(),
    room: comment.room ? comment.room.toString() : null,
    file: comment.file ? comment.file.toString() : null,
    version: comment.version ? comment.version.toString() : null,
    author: comment.author ? comment.author.toString() : null,
    body: comment.body,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt
  };
}

function serializeRoomSummary(summary) {
  if (!summary) return null;
  return {
    issues: summary.issues,
    deliverables: summary.deliverables
  };
}

function mergeRoomWithSummary(roomPayload, summary) {
  if (!summary) return roomPayload;
  return { ...roomPayload, summary: serializeRoomSummary(summary) };
}

async function buildRoomSummaries(roomIds) {
  if (!Array.isArray(roomIds) || roomIds.length === 0) return new Map();
  const ids = roomIds.map(id =>
    typeof id === 'object' ? id : mongoose.Types.ObjectId.createFromHexString(String(id))
  );

  const [issueAgg, deliverableAgg] = await Promise.all([
    EngagementRoomIssue.aggregate([
      { $match: { room: { $in: ids } } },
      {
        $group: {
          _id: '$room',
          total: { $sum: 1 },
          open: {
            $sum: {
              $cond: [{ $ne: ['$status', 'completed'] }, 1, 0]
            }
          }
        }
      }
    ]),
    EngagementRoomDeliverable.aggregate([
      { $match: { room: { $in: ids } } },
      {
        $group: {
          _id: '$room',
          total: { $sum: 1 },
          completed: {
            $sum: {
              $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
            }
          },
          atRisk: {
            $sum: {
              $cond: [{ $eq: ['$status', 'at_risk'] }, 1, 0]
            }
          }
        }
      }
    ])
  ]);

  const summaries = new Map();
  issueAgg.forEach(item => {
    summaries.set(item._id.toString(), {
      issues: { total: item.total || 0, open: item.open || 0 },
      deliverables: { total: 0, completed: 0, atRisk: 0 }
    });
  });

  deliverableAgg.forEach(item => {
    const key = item._id.toString();
    if (!summaries.has(key)) {
      summaries.set(key, {
        issues: { total: 0, open: 0 },
        deliverables: { total: 0, completed: 0, atRisk: 0 }
      });
    }
    const summary = summaries.get(key);
    summary.deliverables.total = item.total || 0;
    summary.deliverables.completed = item.completed || 0;
    summary.deliverables.atRisk = item.atRisk || 0;
  });

  return summaries;
}

async function saveBase64ToStorage(base64, fileName) {
  const safeName = path.basename(fileName || 'upload.bin');
  const storageKey = path.join('room-files', `${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${safeName}`);
  const filePath = path.join(UPLOAD_DIR, storageKey);
  await fsPromises.mkdir(path.dirname(filePath), { recursive: true });
  await fsPromises.writeFile(filePath, Buffer.from(base64, 'base64'));
  return storageKey;
}

function resolveStoragePath(storageKey) {
  if (!storageKey) return null;
  const normalised = path.normalize(storageKey);
  if (normalised.startsWith('..')) return null;
  return path.join(UPLOAD_DIR, normalised);
}

async function callOpenAIJson(systemPrompt, userContent, temperature = 0.3) {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI is not configured');
  }

  const completion = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
      ],
      temperature,
      response_format: { type: 'json_object' }
    })
  });

  if (!completion.ok) {
    const details = await completion.text();
    throw new Error(`OpenAI request failed: ${details}`);
  }

  const data = await completion.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI did not return content');
  }

  return { content, raw: data };
}

function serializeRoomMembership(membership) {
  return {
    id: membership._id.toString(),
    userId: membership.user ? membership.user._id.toString() : null,
    name: membership.user ? membership.user.name : null,
    email: membership.user ? membership.user.email : null,
    licenseTier: membership.user ? membership.user.licenseTier : null,
    organization: membership.organization ? membership.organization.toString() : null,
    role: membership.role,
    isGuest: Boolean(membership.isGuest)
  };
}

function serializeRoomInvite(invite) {
  return {
    id: invite._id.toString(),
    room: invite.room ? invite.room.toString() : null,
    email: invite.email,
    organization: invite.organization ? invite.organization.toString() : null,
    role: invite.role,
    status: invite.status,
    token: invite.token,
    isGuestInvite: invite.isGuestInvite,
    invitedBy: invite.invitedBy ? invite.invitedBy.toString() : null,
    createdAt: invite.createdAt,
    updatedAt: invite.updatedAt
  };
}

const procurementVendorSchema = z.object({
  name: z.string().trim().min(2).max(200),
  category: z.string().trim().max(160).optional(),
  tier: z.enum(['strategic', 'preferred', 'tactical', 'specialist']).optional(),
  businessOwner: z.string().trim().max(160).optional(),
  relationshipManager: z.string().trim().max(160).optional(),
  annualSpend: z.coerce.number().min(0).max(1_000_000_000).optional(),
  renewalDate: z.coerce.date().optional(),
  healthScore: z.coerce.number().min(0).max(100).optional(),
  riskLevel: z.enum(['low', 'medium', 'high']).optional(),
  status: z.enum(['active', 'watchlist', 'sunset']).optional(),
  notes: z.string().trim().max(2000).optional()
});

const procurementObjectiveSchema = z.object({
  title: z.string().trim().min(4).max(240),
  owner: z.string().trim().max(160).optional(),
  targetMetric: z.string().trim().max(200).optional(),
  targetValue: z.coerce.number().optional(),
  unit: z.string().trim().max(40).optional(),
  dueDate: z.coerce.date().optional(),
  status: z.enum(['on-track', 'at-risk', 'blocked', 'completed']).optional(),
  notes: z.string().trim().max(1200).optional()
});

const procurementTouchpointSchema = z.object({
  type: z.string().trim().max(120).optional(),
  occurredOn: z.coerce.date().optional(),
  summary: z.string().trim().min(4).max(800),
  followUp: z.string().trim().max(400).optional(),
  sentiment: z.string().trim().max(120).optional()
});

const revenueAccountSchema = z.object({
  name: z.string().trim().min(2).max(200),
  headcount: z.coerce.number().int().positive().max(1_000_000).optional(),
  ownership: z.string().trim().max(80).optional(),
  industry: z.string().trim().max(160).optional(),
  region: z.string().trim().max(160).optional(),
  website: z.string().trim().url().optional(),
  description: z.string().trim().max(2000).optional(),
  revenueRange: z.string().trim().max(160).optional(),
  isCustomer: z.coerce.boolean().optional()
});

const revenueOpportunitySchema = z.object({
  name: z.string().trim().min(2).max(240),
  value: z.coerce.number().min(0).max(1_000_000_000).optional(),
  stage: z.string().trim().max(160).optional(),
  owner: z.string().trim().max(160).optional(),
  probability: z.coerce.number().min(0).max(100).optional(),
  closeDate: z.coerce.date().optional(),
  summary: z.string().trim().max(4000).optional()
});

const revenueQualificationSchema = z.object({
  framework: z.string().trim().max(160).optional(),
  score: z.coerce.number().min(0).max(100).optional(),
  champion: z.string().trim().max(160).optional(),
  blockers: z.string().trim().max(800).optional(),
  notes: z.string().trim().max(2000).optional()
});

const riskSchema = z.object({
  title: z.string().trim().min(2).max(200),
  severity: z.string().trim().max(80).optional(),
  impact: z.string().trim().max(400).optional(),
  mitigation: z.string().trim().max(400).optional(),
  owner: z.string().trim().max(160).optional()
});

const timelineSchema = z.object({
  milestone: z.string().trim().min(2).max(240),
  targetDate: z.coerce.date().optional(),
  risk: z.string().trim().max(240).optional()
});

const personaSchema = z.object({
  name: z.string().trim().min(2).max(200),
  role: z.string().trim().max(200).optional(),
  influence: z.string().trim().max(160).optional(),
  goals: z.string().trim().max(400).optional(),
  stance: z.string().trim().max(200).optional(),
  contact: z.string().trim().max(200).optional()
});

const requirementSchema = z.object({
  requirement: z.string().trim().min(2).max(320),
  priority: z.string().trim().max(120).optional(),
  owner: z.string().trim().max(160).optional(),
  status: z.string().trim().max(160).optional()
});

const pocSchema = z.object({
  criterion: z.string().trim().min(2).max(320),
  metric: z.string().trim().max(200).optional(),
  status: z.string().trim().max(160).optional(),
  owner: z.string().trim().max(160).optional()
});

const linkSchema = z.object({
  label: z.string().trim().min(2).max(200),
  url: z.string().trim().url(),
  description: z.string().trim().max(320).optional()
});

const collateralSchema = z.object({
  title: z.string().trim().min(2).max(240),
  type: z.string().trim().max(160).optional(),
  url: z.string().trim().url()
});

const revenueCollaborationSchema = z.object({
  risks: z.array(riskSchema).optional(),
  qualification: revenueQualificationSchema.optional(),
  timelines: z.array(timelineSchema).optional(),
  personas: z.array(personaSchema).optional(),
  architecture: z
    .object({
      currentState: z.string().trim().max(2000).optional(),
      proposedState: z.string().trim().max(2000).optional(),
      integrations: z.string().trim().max(2000).optional()
    })
    .optional(),
  technicalRequirements: z.array(requirementSchema).optional(),
  pocSuccess: z.array(pocSchema).optional(),
  customLinks: z.array(linkSchema).optional(),
  collateral: z.array(collateralSchema).optional(),
  summary: z.string().trim().max(2000).optional()
});

const opportunityUpdateSchema = revenueCollaborationSchema.merge(revenueOpportunitySchema.partial());

const meetingNoteSchema = z.object({
  title: z.string().trim().max(240).optional(),
  occurredAt: z.coerce.date(),
  notes: z.string().trim().max(6000).optional(),
  followUps: z.string().trim().max(3000).optional(),
  internalAttendees: z.array(z.string().trim().max(160)).optional(),
  customerAttendees: z.array(z.string().trim().max(160)).optional(),
  transcript: z.string().trim().max(12_000).optional(),
  primaryRep: z.string().trim().max(160).optional()
});

app.get('/api/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

app.get('/api/platforms', (req, res) => {
  res.json({ ok: true, platforms: PLATFORM_DEFINITIONS });
});

function handleWorkOSNotConfigured(req, res) {
  const message = 'WorkOS is not configured';
  if (req.accepts(['json']) && !req.accepts(['html'])) {
    return res.status(503).json({ error: message });
  }
  return res.status(503).send(message);
}

function startWorkOSAuthorization(req, res, screenHint = 'sign-in') {
  if (!workosClient || !WORKOS_CLIENT_ID) {
    return handleWorkOSNotConfigured(req, res);
  }

  try {
    const state = storeWorkOSState(res);
    const authorizationUrl = workosClient.userManagement.getAuthorizationUrl({
      provider: 'authkit',
      clientId: WORKOS_CLIENT_ID,
      redirectUri: resolveWorkOSRedirectUri(req),
      state,
      screenHint
    });

    if (req.accepts(['json']) && !req.accepts(['html'])) {
      return res.json({ ok: true, authorizationUrl });
    }

    return res.redirect(authorizationUrl);
  } catch (err) {
    console.error('Unable to start WorkOS authorization', err);
    if (req.accepts(['json']) && !req.accepts(['html'])) {
      return res.status(500).json({ error: 'Unable to start WorkOS authorization' });
    }
    return res.status(500).send('Unable to start WorkOS authorization');
  }
}

app.get('/api/auth/workos/login', (req, res) => startWorkOSAuthorization(req, res, 'sign-in'));
app.get('/api/auth/workos/signup', (req, res) => startWorkOSAuthorization(req, res, 'sign-up'));

app.post('/api/auth/signup', validateBody(signupSchema), async (req, res) => {
  try {
    const { name, email, password, company, role, industry, licenseTier, platformAccess } = req.validatedBody;

    const normalised = normalisePlatformAccess(licenseTier, platformAccess || ['valuesphere']);
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
      platformAccess: normalised.platformAccess,
      licensePlan: licenseTier === 'business' ? 'consulting-enterprise' : 'free-personal',
      valueAssessmentLimit: licenseTier === 'personal' ? FREE_ASSESSMENT_LIMIT : null
    });

    const token = issueTokenCookie(res, {
      uid: user._id.toString(),
      orgId: user.defaultOrganization ? user.defaultOrganization.toString() : null
    });
    res.json({ ok: true, user: user.public(), token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/auth/workos/callback', async (req, res) => {
  if (!workosClient || !WORKOS_CLIENT_ID) {
    return handleWorkOSNotConfigured(req, res);
  }

  const wantsJson = req.accepts(['json']) && !req.accepts(['html']);
  const redirectUrl = resolveWorkOSSuccessRedirect(req);
  const storedState = consumeWorkOSState(req, res);

  const { code, state } = req.query;
  if (!code) {
    if (wantsJson) return res.status(400).json({ error: 'Missing authorization code' });
    return res.redirect(`${redirectUrl}?error=missing_workos_code`);
  }

  if (!state || !storedState || state !== storedState) {
    if (wantsJson) return res.status(400).json({ error: 'Invalid authorization state' });
    return res.redirect(`${redirectUrl}?error=invalid_workos_state`);
  }

  try {
    const authentication = await workosClient.userManagement.authenticateWithCode({
      code,
      clientId: WORKOS_CLIENT_ID,
      redirectUri: resolveWorkOSRedirectUri(req)
    });

    const workosOrgId = authentication.organization_id || authentication.organizationId || null;
    const profile = authentication?.user || authentication?.profile;
    if (!profile) {
      throw new Error('Missing WorkOS user profile');
    }

    const user = await User.findOrCreateFromWorkOSProfile(profile);
    if (user.status !== 'active') {
      if (wantsJson) return res.status(403).json({ error: 'Account is deactivated.' });
      return res.redirect(`${redirectUrl}?error=account_deactivated`);
    }
    let shouldSave = false;

    let organization = null;
    let membership = null;
    let membershipCreated = false;
    let membershipStatusChanged = false;

    if (workosOrgId) {
      organization = await Organization.findOne({ workosOrganizationId: workosOrgId });

      if (organization) {
        membership = await OrganizationMembership.findOne({ organization: organization._id, user: user._id });
        if (!membership) {
          membership = new OrganizationMembership({ organization: organization._id, user: user._id, role: 'member' });
          membershipCreated = true;
        }

        const previousStatus = membership.status;
        const seatsUsed = await OrganizationMembership.countActiveSeats(organization._id);
        if (membership.status !== 'active') {
          if (seatsUsed >= organization.seatLimit) {
            membership.status = 'suspended';
            await membership.save();
            if (wantsJson) {
              return res
                .status(403)
                .json({ error: 'Seat limit exceeded for this organization. Contact your workspace admin.' });
            }
            return res.redirect(`${redirectUrl}?error=seat_limit_exceeded`);
          }
          membership.status = 'active';
        }

        await membership.save();
        membershipStatusChanged = previousStatus !== membership.status;

        if (organization.tier === 'business' && user.licenseTier !== 'business') {
          user.licenseTier = 'business';
          shouldSave = true;
        }

        if (!user.defaultOrganization) {
          user.defaultOrganization = organization._id;
          shouldSave = true;
        }

        if (membershipCreated || membershipStatusChanged) {
          await recordAuditEvent({
            type: 'org.member.added',
            actorUser: user._id,
            actorOrganization: organization._id,
            targetUser: user._id,
            targetOrganization: organization._id,
            metadata: {
              source: 'workos',
              membershipStatus: membership.status
            }
          });
        }
      }
    }

    if (!user.emailVerified) {
      user.emailVerified = true;
      shouldSave = true;
    }
    user.lastLoginAt = new Date();
    shouldSave = true;

    if (shouldSave && typeof user.save === 'function') {
      await user.save();
    }

    const token = issueTokenCookie(res, {
      uid: user._id.toString(),
      orgId: user.defaultOrganization ? user.defaultOrganization.toString() : null
    });
    if (wantsJson) {
      return res.json({ ok: true, user: user.public(), token, redirect: redirectUrl });
    }

    return res.redirect(redirectUrl);
  } catch (err) {
    console.error('WorkOS callback error', err);
    if (wantsJson) {
      return res.status(500).json({ error: 'Unable to complete WorkOS sign-in' });
    }

    return res.redirect(`${redirectUrl}?error=workos_login_failed`);
  }
});

app.post('/api/auth/login', validateBody(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.validatedBody;
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Account is deactivated.' });
    }
    if (!user.passwordHash) {
      return res.status(400).json({ error: 'Password login is disabled for this account. Use WorkOS to sign in.' });
    }
    const valid = await user.verifyPassword(password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    if (!user.emailVerified) {
      user.emailVerified = true;
    }
    user.lastLoginAt = new Date();
    await user.save();

    const token = issueTokenCookie(res, {
      uid: user._id.toString(),
      orgId: user.defaultOrganization ? user.defaultOrganization.toString() : null
    });
    res.json({ ok: true, user: user.public(), token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/deactivate', requireAuth, async (req, res) => {
  try {
    const user = req.requestingUser || (await User.findById(req.auth.uid));
    if (!user) return res.status(404).json({ error: 'Not found' });

    user.status = 'deactivated';
    await user.save();
    clearTokenCookie(res);
    res.json({ ok: true });
  } catch (err) {
    console.error('User deactivate error', err);
    res.status(500).json({ error: 'Unable to deactivate account' });
  }
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
  clearTokenCookie(res);
  const wantsJson = req.accepts(['json']) && !req.accepts(['html']);
  if (wantsJson) {
    return res.json({ ok: true, redirect: WORKOS_LOGOUT_REDIRECT });
  }
  return res.redirect(WORKOS_LOGOUT_REDIRECT);
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.auth.uid);
    if (!user) return res.status(404).json({ error: 'Not found' });
    let organizationContext = null;
    if (user.defaultOrganization) {
      organizationContext = await buildOrganizationContext(user, user.defaultOrganization, { includeSeatDetails: true });
    }

    const effectiveLicense = computeEffectiveLicense(user, organizationContext);
    const usageLimits = { valueAssessments: computeAssessmentLimit(user) };

    const memberships = await OrganizationMembership.find({
      user: user._id,
      status: { $ne: 'removed' }
    }).populate('organization');

    const membershipsPayload = memberships
      .filter(membership => membership.organization)
      .map(membership => ({
        id: membership._id.toString(),
        organizationId: membership.organization._id.toString(),
        organizationName: membership.organization.name,
        organizationTier: membership.organization.tier,
        organizationOrgType: membership.organization.orgType || 'both',
        role: membership.role,
        status: membership.status,
        isHome:
          !!user.defaultOrganization &&
          membership.organization._id.toString() === user.defaultOrganization.toString()
      }));

    res.json({
      ok: true,
      user: user.public(),
      platforms: PLATFORM_DEFINITIONS,
      organizationContext,
      memberships: membershipsPayload,
      effectiveLicense,
      usageLimits
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.patch('/api/auth/persona', requireAuth, validateBody(personaUpdateSchema), async (req, res) => {
  try {
    const user = await User.findById(req.auth.uid);
    if (!user) return res.status(404).json({ error: 'Not found' });

    user.persona = req.validatedBody.persona;
    await user.save();

    return res.json({ ok: true, user: user.public() });
  } catch (err) {
    console.error('Persona update error', err);
    return res.status(500).json({ error: 'Unable to update persona' });
  }
});

app.patch('/api/auth/valuesphere-mode', requireAuth, validateBody(valuesphereModeUpdateSchema), async (req, res) => {
  try {
    const user = await User.findById(req.auth.uid);
    if (!user) return res.status(404).json({ error: 'Not found' });

    user.valuesphereMode = req.validatedBody.mode;
    await user.save();

    return res.json({ ok: true, user: user.public() });
  } catch (err) {
    console.error('ValueSphere mode update error', err);
    return res.status(500).json({ error: 'Unable to update ValueSphere mode' });
  }
});

app.get('/api/onboarding', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.auth.uid);
    if (!user) return res.status(404).json({ error: 'Not found' });

    const recommendation = recommendLicensePlan(user.persona, user.onboardingResponses?.goals);
    const usageLimits = { valueAssessments: computeAssessmentLimit(user) };

    return res.json({
      ok: true,
      user: user.public(),
      onboarding: {
        status: user.onboardingStatus || 'pending',
        responses: user.onboardingResponses || {},
        recommendation
      },
      licensePlan: user.licensePlan || 'free-personal',
      usageLimits
    });
  } catch (err) {
    console.error('Onboarding fetch error', err);
    return res.status(500).json({ error: 'Unable to load onboarding' });
  }
});

app.post('/api/onboarding', requireAuth, validateBody(onboardingSchema), async (req, res) => {
  try {
    const user = await User.findById(req.auth.uid);
    if (!user) return res.status(404).json({ error: 'Not found' });

    const payload = req.validatedBody;
    const nextResponses = { ...(user.onboardingResponses || {}) };
    ['persona', 'usage', 'goals', 'intent', 'useCases', 'organizationType', 'recommendation', 'licenseSelection', 'billingDetails'].forEach(
      key => {
        if (payload[key] !== undefined) {
          nextResponses[key] = payload[key];
        }
      }
    );

    if (payload.persona) {
      user.persona = payload.persona;
    }

    user.onboardingResponses = nextResponses;
    user.onboardingStatus = payload.status || user.onboardingStatus || 'in-progress';

    const selection = payload.licenseSelection || nextResponses.licenseSelection;
    let isOrgManaged = user.licenseTier === 'business';
    if (!isOrgManaged && user.defaultOrganization) {
      const defaultOrg = await Organization.findById(user.defaultOrganization);
      if (defaultOrg && defaultOrg.tier === 'business') {
        isOrgManaged = true;
      }
    }

    if (selection) {
      if (!isOrgManaged) {
        applyLicenseSelection(user, selection);
      }
      user.onboardingStatus = 'completed';
    }

    const recommendation = payload.recommendation || recommendLicensePlan(user.persona, nextResponses.goals);
    user.onboardingResponses.recommendation = recommendation;
    if (payload.billingDetails) {
      user.billingProfile = { ...(user.billingProfile || {}), ...payload.billingDetails };
    }

    await user.save();

    const usageLimits = { valueAssessments: computeAssessmentLimit(user) };
    return res.json({
      ok: true,
      user: user.public(),
      onboarding: {
        status: user.onboardingStatus,
        responses: user.onboardingResponses,
        recommendation
      },
      usageLimits
    });
  } catch (err) {
    console.error('Onboarding update error', err);
    return res.status(500).json({ error: 'Unable to save onboarding' });
  }
});

app.post('/api/onboarding/restart', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.auth.uid);
    if (!user) return res.status(404).json({ error: 'Not found' });

    user.onboardingStatus = 'pending';
    user.onboardingResponses = {};
    user.persona = 'unknown';
    user.billingProfile = {};
    applyLicenseSelection(user, 'free-personal');

    await user.save();

    const recommendation = recommendLicensePlan(user.persona);
    const usageLimits = { valueAssessments: computeAssessmentLimit(user) };

    return res.json({
      ok: true,
      user: user.public(),
      onboarding: { status: user.onboardingStatus, responses: user.onboardingResponses, recommendation },
      usageLimits
    });
  } catch (err) {
    console.error('Onboarding restart error', err);
    return res.status(500).json({ error: 'Unable to restart onboarding' });
  }
});

app.post('/api/agama-admin/unlock', requireAuth, requireAgamaStaff, validateBody(adminUnlockSchema), async (req, res) => {
  try {
    // Config seeded manually until UI + rotation exist.
    const config = await AdminConfig.findById('agama-admin-console');
    if (!config) {
      return res.status(500).json({ error: 'ADMIN_CONFIG_MISSING' });
    }

    if (req.validatedBody.secret !== config.secretKey) {
      return res.status(403).json({ error: 'INVALID_SECRET' });
    }

    res.cookie(AGAMA_ADMIN_UNLOCK_COOKIE, 'true', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: AGAMA_ADMIN_UNLOCK_TTL_MS,
      path: '/'
    });

    await recordAuditEvent({
      type: 'staff.console.unlocked',
      actorUser: req.requestingUser?._id || req.auth.uid,
      metadata: {
        ip: req.ip,
        userAgent: req.get('user-agent') || undefined
      }
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error('Admin console unlock failed', err);
    return res.status(500).json({ error: 'Unable to unlock admin console' });
  }
});

app.get('/api/agama-admin/status', requireAuth, requireAgamaStaff, async (req, res) => {
  try {
    const user = req.requestingUser || (req.auth?.uid ? await User.findById(req.auth.uid) : null);
    const unlocked = req.cookies?.[AGAMA_ADMIN_UNLOCK_COOKIE] === 'true';
    return res.json({ ok: true, isStaff: isAgamaStaff(user), unlocked });
  } catch (err) {
    console.error('Admin console status failed', err);
    return res.status(500).json({ error: 'Unable to fetch admin status' });
  }
});

app.get(
  '/api/agama-admin/organizations',
  requireAuth,
  requireAgamaStaff,
  requireAdminConsoleUnlocked,
  async (req, res) => {
    try {
      const organizations = await Organization.find({}).sort({ createdAt: -1 });
      const payload = await Promise.all(
        organizations.map(async org => {
          const seatsUsed = await OrganizationMembership.countActiveSeats(org._id);
          return {
            id: org._id.toString(),
            name: org.name,
            slug: org.slug,
            tier: org.tier,
            orgType: org.orgType || 'both',
            productAccess: Array.isArray(org.productAccess)
              ? org.productAccess
              : Array.isArray(org.platformAccess)
                ? org.platformAccess
                : [],
            domains: Array.isArray(org.domains) ? org.domains : [],
            seatLimit: org.seatLimit,
            seatsUsed,
            workosOrganizationId: org.workosOrganizationId,
            createdAt: org.createdAt
          };
        })
      );

      return res.json({ ok: true, organizations: payload });
    } catch (err) {
      console.error('Admin list organizations failed', err);
      return res.status(500).json({ error: 'Unable to list organizations' });
    }
  }
);

app.get('/api/agama-admin/audit', requireAuth, requireAgamaStaff, requireAdminConsoleUnlocked, async (req, res) => {
  try {
    const { orgId, userId } = req.query;
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const query = { createdAt: { $gte: ninetyDaysAgo } };

    if (orgId) {
      query.$or = [{ actorOrganization: orgId }, { targetOrganization: orgId }];
    }

    if (userId) {
      let userFilter = null;
      if (mongoose.Types.ObjectId.isValid(userId)) {
        userFilter = userId;
      } else {
        const user = await User.findOne({ email: userId.toLowerCase() }).select('_id');
        if (user) {
          userFilter = user._id;
        }
      }

      if (!userFilter) {
        return res.json({ ok: true, events: [] });
      }

      query.$or = query.$or
        ? [...query.$or, { actorUser: userFilter }, { targetUser: userFilter }]
        : [{ actorUser: userFilter }, { targetUser: userFilter }];
    }

    const events = await AuditEvent.find(query)
      .sort({ createdAt: -1 })
      .limit(200)
      .populate({ path: 'actorUser', select: 'name email' })
      .populate({ path: 'targetUser', select: 'name email' })
      .populate({ path: 'actorOrganization', select: 'name slug' })
      .populate({ path: 'targetOrganization', select: 'name slug' })
      .populate({ path: 'targetRoom', select: 'title' });

    res.json({ ok: true, events: events.map(serializeAuditEvent) });
  } catch (err) {
    console.error('Agama staff audit fetch failed', err);
    res.status(500).json({ error: 'Unable to load audit events' });
  }
});

app.get('/api/org/current', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.auth.uid);
    if (!user) return res.status(404).json({ error: 'Not found' });

    const orgId = req.auth.orgId || user.defaultOrganization;
    let organizationPayload = null;
    let orgContext = null;

    if (orgId) {
      const organization = await Organization.findById(orgId);
      const membership = organization
        ? await OrganizationMembership.findOne({ organization: orgId, user: user._id, status: 'active' })
        : null;

      if (organization && membership) {
        const productAccess = Array.isArray(organization.productAccess)
          ? [...organization.productAccess]
          : Array.isArray(organization.platformAccess)
            ? [...organization.platformAccess]
            : [];

        organizationPayload = {
          id: organization._id.toString(),
          name: organization.name,
          orgType: organization.orgType || 'both',
          productAccess
        };

        orgContext = {
          id: organization._id.toString(),
          name: organization.name,
          tier: organization.tier,
          orgType: organization.orgType || 'both',
          role: membership.role
        };
      }
    }

    const licenseTier = user.licenseTier || 'personal';
    const effectiveLicense = computeEffectiveLicense(user, orgContext);

    res.json({
      ok: true,
      organization: organizationPayload,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        licenseTier
      },
      effectiveLicenseTier: effectiveLicense.tier,
      homeOrganization: effectiveLicense.homeOrg
    });
  } catch (err) {
    console.error('Org current error', err);
    res.status(500).json({ error: 'Unable to fetch organization context' });
  }
});

app.get('/api/org/members', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.auth.uid);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const orgId = req.auth.orgId || user.defaultOrganization;
    if (!orgId) {
      return res.status(400).json({ error: 'No organization selected' });
    }

    const membership = await OrganizationMembership.findOne({
      organization: orgId,
      user: user._id,
      status: 'active'
    });

    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this organization.' });
    }

    const organization = await Organization.findById(orgId);
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const members = await OrganizationMembership.find({ organization: orgId, status: { $ne: 'removed' } }).populate({
      path: 'user',
      select: 'name email'
    });

    res.json({
      ok: true,
      organization: {
        id: organization._id.toString(),
        name: organization.name,
        tier: organization.tier,
        orgType: organization.orgType || 'both'
      },
      members: members.map(member => ({
        id: member._id.toString(),
        userId: member.user ? member.user._id.toString() : null,
        name: member.user ? member.user.name : null,
        email: member.user ? member.user.email : member.invitedEmail,
        role: member.role,
        status: member.status
      }))
    });
  } catch (err) {
    console.error('Org members error', err);
    res.status(500).json({ error: 'Unable to fetch organization members' });
  }
});

app.get('/api/org/users/search', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.auth.uid);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.licenseTier === 'guest') {
      return res.status(403).json({ error: 'Guest users cannot access the directory.' });
    }

    const orgId = req.auth.orgId || user.defaultOrganization;
    if (!orgId) {
      return res.status(400).json({ error: 'No organization selected' });
    }

    const membership = await OrganizationMembership.findOne({ organization: orgId, user: user._id, status: 'active' });
    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this organization.' });
    }

    const query = String(req.query.q || '').trim().toLowerCase();
    const orgMembers = await OrganizationMembership.find({ organization: orgId, status: 'active' }).populate({
      path: 'user',
      select: 'name email licenseTier'
    });

    const matches = orgMembers.filter(member => {
      if (!member.user) return false;
      if (!query) return true;
      const haystack = `${member.user.name || ''} ${member.user.email || ''}`.toLowerCase();
      return haystack.includes(query);
    });

    res.json({
      ok: true,
      users: matches.slice(0, 25).map(member => ({
        id: member.user._id.toString(),
        name: member.user.name,
        email: member.user.email,
        licenseTier: member.user.licenseTier
      }))
    });
  } catch (err) {
    console.error('User search error', err);
    res.status(500).json({ error: 'Unable to search users' });
  }
});

app.get('/api/org/admin/overview', requireAuth, requireOrgAdmin, async (req, res) => {
  try {
    const organization = req.organization;
    const productAccess = Array.isArray(organization.productAccess)
      ? [...organization.productAccess]
      : Array.isArray(organization.platformAccess)
        ? [...organization.platformAccess]
        : [];

    const seatsUsed = await OrganizationMembership.countActiveSeats(organization._id);
    const members = await OrganizationMembership.find({
      organization: organization._id,
      status: { $ne: 'removed' }
    }).populate({ path: 'user', select: 'name email licenseTier lastLoginAt' });

    res.json({
      ok: true,
      organization: {
        id: organization._id.toString(),
        name: organization.name,
        slug: organization.slug,
        orgType: organization.orgType || 'both',
        tier: organization.tier,
        productAccess,
        seatLimit: organization.seatLimit,
        seatsUsed,
        createdAt: organization.createdAt
      },
      members: members.map(serializeMembership)
    });
  } catch (err) {
    console.error('Org admin overview error', err);
    res.status(500).json({ error: 'Unable to load organization overview' });
  }
});

app.post('/api/org/admin/members', requireAuth, requireOrgAdmin, validateBody(membershipCreateSchema), async (req, res) => {
  try {
    const { email, role } = req.validatedBody;
    const normalizedEmail = email.toLowerCase().trim();

    let user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      user = await User.create({
        email: normalizedEmail,
        licenseTier: 'guest',
        platformAccess: []
      });
    }

    let membership = await OrganizationMembership.findOne({ organization: req.organization._id, user: user._id });
    if (membership && membership.status !== 'removed') {
      return res.status(400).json({ error: 'User is already a member of this organization.' });
    }

    if (membership && membership.status === 'removed') {
      membership.role = role;
      membership.status = 'invited';
      membership.invitedEmail = normalizedEmail;
      await membership.save();
    } else {
      membership = await OrganizationMembership.create({
        organization: req.organization._id,
        user: user._id,
        role,
        status: 'invited',
        invitedEmail: normalizedEmail
      });
    }

    await membership.populate({ path: 'user', select: 'name email licenseTier lastLoginAt' });
    await recordAuditEvent({
      type: 'org.member.added',
      actorUser: req.requestingUser?._id || req.auth.uid,
      actorOrganization: req.organization._id,
      targetUser: membership.user?._id || membership.user,
      targetOrganization: req.organization._id,
      metadata: { role: membership.role, status: membership.status }
    });
    res.status(201).json({ ok: true, member: serializeMembership(membership) });
  } catch (err) {
    console.error('Org admin invite error', err);
    res.status(500).json({ error: 'Unable to invite member' });
  }
});

app.patch(
  '/api/org/admin/members/:membershipId',
  requireAuth,
  requireOrgAdmin,
  validateBody(membershipUpdateSchema),
  async (req, res) => {
    try {
      const membership = await OrganizationMembership.findById(req.params.membershipId).populate({
        path: 'user',
        select: 'name email licenseTier lastLoginAt'
      });
      if (!membership) {
        return res.status(404).json({ error: 'Membership not found' });
      }
      if (membership.organization.toString() !== req.organization._id.toString()) {
        return res.status(403).json({ error: 'ORG_ADMIN_ONLY' });
      }

      const ownerCount = await OrganizationMembership.countDocuments({
        organization: req.organization._id,
        role: 'owner',
        status: { $ne: 'removed' }
      });

      const nextRole = req.validatedBody.role;
      const nextStatus = req.validatedBody.status;
      const previousRole = membership.role;
      const previousStatus = membership.status;

      if (membership.role === 'owner' && ownerCount <= 1) {
        if (nextRole && nextRole !== 'owner') {
          return res.status(400).json({ error: 'Cannot remove the last owner.' });
        }
        if (nextStatus && nextStatus === 'removed') {
          return res.status(400).json({ error: 'Cannot remove the last owner.' });
        }
      }

      const isSelf = membership.user && membership.user._id && membership.user._id.toString() === req.requestingUser._id.toString();
      if (isSelf && membership.role === 'owner' && ownerCount <= 1 && nextRole && nextRole !== 'owner') {
        return res.status(400).json({ error: 'You must keep at least one owner on the organization.' });
      }

      if (nextRole) {
        membership.role = nextRole;
      }
      if (nextStatus) {
        membership.status = nextStatus;
      }

      await membership.save();
      await recordAuditEvent({
        type: 'org.member.updated',
        actorUser: req.requestingUser?._id || req.auth.uid,
        actorOrganization: req.organization._id,
        targetUser: membership.user?._id || membership.user,
        targetOrganization: req.organization._id,
        metadata: {
          previousRole,
          previousStatus,
          role: membership.role,
          status: membership.status
        }
      });
      res.json({ ok: true, member: serializeMembership(membership) });
    } catch (err) {
      console.error('Org admin update member error', err);
      res.status(500).json({ error: 'Unable to update member' });
    }
  }
);

app.post('/api/org/admin/members/:membershipId/resend-invite', requireAuth, requireOrgAdmin, async (req, res) => {
  try {
    const membership = await OrganizationMembership.findById(req.params.membershipId).populate({
      path: 'user',
      select: 'name email licenseTier lastLoginAt'
    });
    if (!membership) {
      return res.status(404).json({ error: 'Membership not found' });
    }
    if (membership.organization.toString() !== req.organization._id.toString()) {
      return res.status(403).json({ error: 'ORG_ADMIN_ONLY' });
    }
    if (membership.status !== 'invited') {
      return res.status(400).json({ error: 'Only pending invites can be resent.' });
    }

    return res.json({ ok: true, member: serializeMembership(membership) });
  } catch (err) {
    console.error('Org admin resend invite error', err);
    return res.status(500).json({ error: 'Unable to resend invite' });
  }
});

app.delete('/api/org/admin/members/:membershipId', requireAuth, requireOrgAdmin, async (req, res) => {
  try {
    const membership = await OrganizationMembership.findById(req.params.membershipId);
    if (!membership) {
      return res.status(404).json({ error: 'Membership not found' });
    }
    if (membership.organization.toString() !== req.organization._id.toString()) {
      return res.status(403).json({ error: 'ORG_ADMIN_ONLY' });
    }

    const ownerCount = await OrganizationMembership.countDocuments({
      organization: req.organization._id,
      role: 'owner',
      status: { $ne: 'removed' }
    });

    if (membership.role === 'owner' && ownerCount <= 1) {
      return res.status(400).json({ error: 'Cannot remove the last owner.' });
    }

    const previousStatus = membership.status;
    membership.status = 'removed';
    await membership.save();
    await recordAuditEvent({
      type: 'org.member.removed',
      actorUser: req.requestingUser?._id || req.auth.uid,
      actorOrganization: req.organization._id,
      targetUser: membership.user,
      targetOrganization: req.organization._id,
      metadata: { previousStatus }
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('Org admin delete member error', err);
    res.status(500).json({ error: 'Unable to remove member' });
  }
});

app.get('/api/org/admin/audit', requireAuth, requireOrgAdmin, async (req, res) => {
  try {
    const orgId = req.organization._id;
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const query = {
      createdAt: { $gte: ninetyDaysAgo },
      $or: [{ actorOrganization: orgId }, { targetOrganization: orgId }]
    };

    const events = await AuditEvent.find(query)
      .sort({ createdAt: -1 })
      .limit(200)
      .populate({ path: 'actorUser', select: 'name email' })
      .populate({ path: 'targetUser', select: 'name email' })
      .populate({ path: 'actorOrganization', select: 'name slug' })
      .populate({ path: 'targetOrganization', select: 'name slug' })
      .populate({ path: 'targetRoom', select: 'title' });

    res.json({ ok: true, events: events.map(serializeAuditEvent) });
  } catch (err) {
    console.error('Org admin audit fetch failed', err);
    res.status(500).json({ error: 'Unable to load audit history' });
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

app.delete('/api/auth/me/data', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.auth.uid);
    if (!user) return res.status(404).json({ error: 'Profile not found' });

    await purgeUserOwnedData(user);

    user.name = null;
    user.company = null;
    user.role = null;
    user.industry = null;
    user.persona = 'unknown';
    user.onboardingStatus = 'pending';
    user.onboardingResponses = {};
    user.platformAccess = ['valuesphere'];
    user.licenseTier = 'personal';
    user.licensePlan = 'free-personal';
    user.valueAssessmentLimit = FREE_ASSESSMENT_LIMIT;
    user.billingProfile = {};
    user.defaultOrganization = null;
    await user.save();

    res.json({ ok: true });
  } catch (err) {
    console.error('Profile data delete error', err);
    res.status(500).json({ error: 'Unable to delete profile data' });
  }
});

app.delete('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.auth.uid);
    if (user) {
      await purgeUserOwnedData(user);
      if (user.workosUserId && workosClient) {
        try {
          await workosClient.userManagement.deleteUser(user.workosUserId);
        } catch (workosErr) {
          console.error('WorkOS user delete error', workosErr);
        }
      }
      await User.deleteOne({ _id: req.auth.uid });
    }
    clearTokenCookie(res);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to delete profile' });
  }
});

app.post(
  '/api/admin/organizations',
  requireAuth,
  requireStaff,
  validateBody(adminOrganizationCreateSchema),
  async (req, res) => {
    try {
      const { name, orgType, tier, productAccess, seatLimit, domains, workosOrganizationId } = req.validatedBody;
      const slug = await generateUniqueOrgSlug(name);
      const normalizedProductAccess = normaliseProductAccess(productAccess);

      const organization = await Organization.create({
        name,
        slug,
        orgType,
        tier,
        productAccess: normalizedProductAccess,
        platformAccess: normalizedProductAccess,
        seatLimit: seatLimit ?? 10,
        domains: domains || [],
        workosOrganizationId,
        createdBy: req.auth.uid
      });

      res.status(201).json({
        ok: true,
        organization: {
          id: organization._id.toString(),
          name: organization.name,
          orgType: organization.orgType,
          tier: organization.tier,
          productAccess: organization.productAccess,
          seatLimit: organization.seatLimit,
          domains: organization.domains,
          workosOrganizationId: organization.workosOrganizationId,
          createdAt: organization.createdAt
        }
      });
    } catch (err) {
      console.error('Admin create org error', err);
      res.status(500).json({ error: 'Unable to create organization' });
    }
  }
);

app.get('/api/admin/organizations', requireAuth, requireStaff, async (req, res) => {
  try {
    const organizations = await Organization.find({}).sort({ createdAt: -1 });
    res.json({
      ok: true,
      organizations: organizations.map(org => ({
        id: org._id.toString(),
        name: org.name,
        orgType: org.orgType || 'both',
        tier: org.tier,
        productAccess: Array.isArray(org.productAccess) ? org.productAccess : [],
        domains: org.domains || [],
        seatLimit: org.seatLimit,
        workosOrganizationId: org.workosOrganizationId,
        createdAt: org.createdAt
      }))
    });
  } catch (err) {
    console.error('Admin list orgs error', err);
    res.status(500).json({ error: 'Unable to list organizations' });
  }
});

app.patch(
  '/api/admin/organizations/:id',
  requireAuth,
  requireStaff,
  validateBody(adminOrganizationUpdateSchema),
  async (req, res) => {
    try {
      const organization = await Organization.findById(req.params.id);
      if (!organization) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      const payload = req.validatedBody;
      if (payload.name !== undefined) organization.name = payload.name.trim();
      if (payload.orgType) organization.orgType = payload.orgType;
      if (payload.tier) organization.tier = payload.tier;
      if (payload.productAccess !== undefined) {
        const normalized = normaliseProductAccess(payload.productAccess);
        organization.productAccess = normalized;
        organization.platformAccess = normalized;
      }
      if (payload.seatLimit !== undefined) organization.seatLimit = payload.seatLimit;
      if (payload.domains !== undefined) organization.domains = payload.domains;
      if (payload.workosOrganizationId !== undefined) organization.workosOrganizationId = payload.workosOrganizationId;

      await organization.save();

      res.json({
        ok: true,
        organization: {
          id: organization._id.toString(),
          name: organization.name,
          orgType: organization.orgType,
          tier: organization.tier,
          productAccess: organization.productAccess,
          seatLimit: organization.seatLimit,
          domains: organization.domains,
          workosOrganizationId: organization.workosOrganizationId
        }
      });
    } catch (err) {
      console.error('Admin update org error', err);
      res.status(500).json({ error: 'Unable to update organization' });
    }
  }
);

app.get('/api/orgs', requireAuth, async (req, res) => {
  try {
    const memberships = await OrganizationMembership.find({ user: req.auth.uid, status: 'active' }).populate(
      'organization'
    );

    const organizations = await Promise.all(
      memberships
        .filter(m => m.organization)
        .map(async membership => {
          const org = membership.organization;
          const seatsUsed = await OrganizationMembership.countActiveSeats(org._id);
          return {
            id: org._id.toString(),
            name: org.name,
            slug: org.slug,
            tier: org.tier,
            seatLimit: org.seatLimit,
            seatsUsed,
            role: membership.role
          };
        })
    );

    res.json({ ok: true, organizations });
  } catch (err) {
    console.error('List orgs error', err);
    res.status(500).json({ error: 'Unable to list organizations' });
  }
});

app.post('/api/orgs', requireAuth, validateBody(organizationCreateSchema), async (req, res) => {
  try {
    const payload = req.validatedBody;
    const normalizedProductAccess = normaliseProductAccess(payload.platformAccess || ['valuesphere']);
    const personalProductAccess = normalizedProductAccess.filter(id => PERSONAL_ALLOWED_PLATFORMS.has(id));
    const productAccess = personalProductAccess.length > 0 ? personalProductAccess : ['valuesphere'];
    const orgType =
      payload.orgType && ['vendor', 'buyer', 'both'].includes(payload.orgType) ? payload.orgType : 'both';
    const baseSlug = payload.slug
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '')
      .slice(0, 60);

    let slug = baseSlug || `org-${Date.now()}`;
    let suffix = 1;
    while (await Organization.findOne({ slug })) {
      slug = `${baseSlug}-${suffix++}`;
    }

    const organization = await Organization.create({
      name: payload.name,
      slug,
      domains: payload.domains || [],
      seatLimit: payload.seatLimit || 10,
      tier: 'personal',
      platformAccess: productAccess,
      productAccess,
      orgType,
      createdBy: req.auth.uid
    });

    await OrganizationMembership.create({
      organization: organization._id,
      user: req.auth.uid,
      role: 'owner',
      status: 'active'
    });

    const user = await User.findById(req.auth.uid);
    if (user && !user.defaultOrganization) {
      user.defaultOrganization = organization._id;
      await user.save();
    }

    const seatsUsed = await OrganizationMembership.countActiveSeats(organization._id);

    res.status(201).json({
      ok: true,
      organization: {
        id: organization._id.toString(),
        name: organization.name,
        slug: organization.slug,
        tier: organization.tier,
        seatLimit: organization.seatLimit,
        seatsUsed,
        role: 'owner'
      }
    });
  } catch (err) {
    console.error('Create org error', err);
    res.status(500).json({ error: 'Unable to create organization' });
  }
});

app.get('/api/orgs/:orgId', requireAuth, requireOrgRole('viewer'), async (req, res) => {
  try {
    const seatsUsed = await OrganizationMembership.countActiveSeats(req.organization._id);
    res.json({
      ok: true,
      organization: {
        id: req.organization._id.toString(),
        name: req.organization.name,
        slug: req.organization.slug,
        tier: req.organization.tier,
        seatLimit: req.organization.seatLimit,
        seatsUsed,
        role: req.orgMembership.role
      }
    });
  } catch (err) {
    console.error('Get org error', err);
    res.status(500).json({ error: 'Unable to fetch organization' });
  }
});

app.put('/api/orgs/:orgId', requireAuth, requireOrgRole('owner'), validateBody(organizationUpdateSchema), async (req, res) => {
  try {
    const requestingUser = req.requestingUser || (await User.findById(req.auth.uid));
    if (req.organization.tier === 'business' && (!requestingUser || requestingUser.isStaff !== true)) {
      return res.status(403).json({ error: 'STAFF_ONLY' });
    }

    const payload = req.validatedBody;
    if (payload.name !== undefined) req.organization.name = payload.name.trim();
    if (payload.seatLimit !== undefined) req.organization.seatLimit = payload.seatLimit;
    if (payload.platformAccess) {
      const normalized = normaliseProductAccess(payload.platformAccess);
      const allowedAccess =
        req.organization.tier === 'personal'
          ? normalized.filter(id => PERSONAL_ALLOWED_PLATFORMS.has(id))
          : normalized;
      if (allowedAccess.length > 0) {
        req.organization.platformAccess = allowedAccess;
        req.organization.productAccess = allowedAccess;
      }
    }
    await req.organization.save();

    const seatsUsed = await OrganizationMembership.countActiveSeats(req.organization._id);
    res.json({
      ok: true,
      organization: {
        id: req.organization._id.toString(),
        name: req.organization.name,
        slug: req.organization.slug,
        tier: req.organization.tier,
        seatLimit: req.organization.seatLimit,
        seatsUsed,
        role: req.orgMembership.role
      }
    });
  } catch (err) {
    console.error('Update org error', err);
    res.status(500).json({ error: 'Unable to update organization' });
  }
});

app.get('/api/orgs/:orgId/members', requireAuth, requireOrgRole('admin'), async (req, res) => {
  try {
    const members = await OrganizationMembership.find({ organization: req.organization._id }).populate({
      path: 'user',
      select: 'name email'
    });

    const formatted = members.map(member => ({
      id: member._id.toString(),
      userId: member.user ? member.user._id.toString() : null,
      name: member.user ? member.user.name : null,
      email: member.user ? member.user.email : member.invitedEmail,
      role: member.role,
      status: member.status
    }));

    res.json({ ok: true, members: formatted });
  } catch (err) {
    console.error('List members error', err);
    res.status(500).json({ error: 'Unable to list members' });
  }
});

app.post(
  '/api/orgs/:orgId/members',
  requireAuth,
  requireOrgRole('admin'),
  validateBody(membershipCreateSchema),
  async (req, res) => {
    try {
      const { email, role } = req.validatedBody;
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      let membership = await OrganizationMembership.findOne({ organization: req.organization._id, user: user._id });
      if (!membership) {
        membership = new OrganizationMembership({ organization: req.organization._id, user: user._id });
      }

      if (role) membership.role = role;

      const isActivating = membership.isNew || membership.status !== 'active';
      if (isActivating) {
        const seatsUsed = await OrganizationMembership.countActiveSeats(req.organization._id);
        if (seatsUsed >= req.organization.seatLimit) {
          membership.status = 'suspended';
          await membership.save();
          return res
            .status(403)
            .json({ error: 'Seat limit exceeded for this organization. Contact your workspace admin.' });
        }
        membership.status = 'active';
      }

      await membership.save();

      res.status(201).json({
        ok: true,
        member: {
          id: membership._id.toString(),
          userId: user._id.toString(),
          name: user.name,
          email: user.email,
          role: membership.role,
          status: membership.status
        }
      });
    } catch (err) {
      console.error('Create member error', err);
      res.status(500).json({ error: 'Unable to add member' });
    }
  }
);

app.put(
  '/api/orgs/:orgId/members/:memberId',
  requireAuth,
  requireOrgRole('admin'),
  validateBody(membershipUpdateSchema),
  async (req, res) => {
    try {
      const membership = await OrganizationMembership.findOne({
        _id: req.params.memberId,
        organization: req.organization._id
      });

      if (!membership) return res.status(404).json({ error: 'Member not found' });

      const payload = req.validatedBody;

      if (membership.role === 'owner' && payload.role && payload.role !== 'owner') {
        const otherOwners = await OrganizationMembership.countDocuments({
          organization: req.organization._id,
          role: 'owner',
          status: 'active',
          _id: { $ne: membership._id }
        });
        if (otherOwners === 0) {
          return res.status(400).json({ error: 'At least one owner is required.' });
        }
      }

      if (payload.status === 'active' && membership.status !== 'active') {
        const seatsUsed = await OrganizationMembership.countActiveSeats(req.organization._id);
        if (seatsUsed >= req.organization.seatLimit) {
          return res
            .status(403)
            .json({ error: 'Seat limit exceeded for this organization. Contact your workspace admin.' });
        }
      }

      if (payload.role) membership.role = payload.role;
      if (payload.status) {
        if (membership.role === 'owner' && payload.status !== 'active') {
          const otherOwners = await OrganizationMembership.countDocuments({
            organization: req.organization._id,
            role: 'owner',
            status: 'active',
            _id: { $ne: membership._id }
          });
          if (otherOwners === 0) {
            return res.status(400).json({ error: 'At least one owner is required.' });
          }
        }
        membership.status = payload.status;
      }

      await membership.save();

      res.json({
        ok: true,
        member: {
          id: membership._id.toString(),
          userId: membership.user.toString(),
          role: membership.role,
          status: membership.status
        }
      });
    } catch (err) {
      console.error('Update member error', err);
      res.status(500).json({ error: 'Unable to update member' });
    }
  }
);

app.delete('/api/orgs/:orgId/members/:memberId', requireAuth, requireOrgRole('admin'), async (req, res) => {
  try {
    const membership = await OrganizationMembership.findOne({
      _id: req.params.memberId,
      organization: req.organization._id
    });
    if (!membership) return res.status(404).json({ error: 'Member not found' });

    if (membership.role === 'owner') {
      const otherOwners = await OrganizationMembership.countDocuments({
        organization: req.organization._id,
        role: 'owner',
        status: 'active',
        _id: { $ne: membership._id }
      });
      if (otherOwners === 0) {
        return res.status(400).json({ error: 'At least one owner is required.' });
      }
    }

    await membership.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete member error', err);
    res.status(500).json({ error: 'Unable to delete member' });
  }
});

app.post(
  '/api/orgs/:orgId/workos/admin-portal-link',
  requireAuth,
  requireOrgRole('admin'),
  async (req, res) => {
    if (!workosClient) {
      return res.status(500).json({ error: 'WorkOS is not configured.' });
    }

    try {
      const org = req.organization;
      if (!org.workosOrganizationId) {
        return res.status(400).json({ error: 'Organization is not linked to a WorkOS organization.' });
      }

      const returnUrl =
        process.env.WORKOS_PORTAL_RETURN_URL ||
        `${APP_BASE_URL || 'https://www.agamatechnologies.com'}/workspace.html`;

      const { link } = await workosClient.portal.generateLink({
        organization: org.workosOrganizationId,
        intent: 'sso',
        returnUrl
      });

      return res.json({ ok: true, link });
    } catch (err) {
      console.error('Admin Portal link error', err);
      return res.status(500).json({ error: 'Unable to generate Admin Portal link.' });
    }
  }
);

app.get('/api/rooms', requireAuth, async (req, res) => {
  try {
    const memberships = await EngagementRoomMembership.find({ user: req.auth.uid })
      .populate('room')
      .populate('organization', 'name orgType tier');

    const validMemberships = memberships.filter(m => m.room);
    const roomIds = validMemberships.map(m => m.room._id);
    const summaries = await buildRoomSummaries(roomIds);

    const rooms = validMemberships.map(m =>
      mergeRoomWithSummary(serializeRoom(m.room, m), summaries.get(m.room._id.toString()))
    );

    rooms.sort((a, b) => {
      const aDate = a?.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
      const bDate = b?.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
      return bDate - aDate;
    });

    res.json({ ok: true, rooms });
  } catch (err) {
    console.error('List rooms error', err);
    res.status(500).json({ error: 'Unable to list rooms' });
  }
});

app.post('/api/rooms', requireAuth, validateBody(roomCreateSchema), async (req, res) => {
  try {
    const payload = req.validatedBody;
    if (payload.vendorOrg === payload.buyerOrg) {
      return res.status(400).json({ error: 'Vendor and buyer organizations must differ.' });
    }

    const vendorOrg = await Organization.findById(payload.vendorOrg);
    const buyerOrg = await Organization.findById(payload.buyerOrg);
    if (!vendorOrg || !buyerOrg) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    if (vendorOrg.orgType === 'buyer') {
      return res.status(400).json({ error: 'Vendor organization must allow vendor engagements.' });
    }
    if (buyerOrg.orgType === 'vendor') {
      return res.status(400).json({ error: 'Buyer organization must allow buyer engagements.' });
    }

    const vendorMembership = await findActiveOrgMembership(req.auth.uid, vendorOrg._id);
    const buyerMembership = await findActiveOrgMembership(req.auth.uid, buyerOrg._id);
    if (!vendorMembership && !buyerMembership) {
      return res.status(403).json({ error: 'No active membership for either organization.' });
    }

    const user = await User.findById(req.auth.uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const membershipOrg = vendorMembership ? vendorOrg : buyerOrg;
    const membershipContext = vendorMembership || buyerMembership;
    const orgContext =
      membershipOrg && membershipContext
        ? {
            id: membershipOrg._id.toString(),
            name: membershipOrg.name,
            tier: membershipOrg.tier,
            orgType: membershipOrg.orgType || 'both',
            role: membershipContext.role
          }
        : null;

    const effectiveLicense = computeEffectiveLicense(user, orgContext);
    if (effectiveLicense.tier !== 'business') {
      return res.status(403).json({ error: 'BUSINESS_TIER_REQUIRED_FOR_ROOM_CREATION' });
    }

    if (payload.revenueAccount) {
      const revenueAccount = await RevenueAccount.findById(payload.revenueAccount);
      if (!revenueAccount) return res.status(404).json({ error: 'Revenue account not found' });
    }

    if (payload.procurementVendor) {
      const procurementVendor = await ProcurementVendor.findById(payload.procurementVendor);
      if (!procurementVendor) return res.status(404).json({ error: 'Procurement vendor not found' });
    }

    const room = await EngagementRoom.create({
      title: payload.title,
      vendorOrg: vendorOrg._id,
      buyerOrg: buyerOrg._id,
      revenueAccount: payload.revenueAccount,
      procurementVendor: payload.procurementVendor,
      createdBy: req.auth.uid,
      status: 'active',
      lastActivityAt: new Date()
    });

    await EngagementRoomMembership.create({
      room: room._id,
      user: req.auth.uid,
      organization: membershipOrg._id,
      role: 'room_admin',
      isGuest: user && user.licenseTier === 'guest'
    });

    await recordAuditEvent({
      type: 'room.created',
      actorUser: req.auth.uid,
      actorOrganization: membershipOrg._id,
      targetRoom: room._id,
      targetOrganization: membershipOrg._id,
      metadata: {
        title: room.title,
        vendorOrg: vendorOrg._id,
        buyerOrg: buyerOrg._id
      }
    });

    res.status(201).json({
      ok: true,
      room: serializeRoom(room, {
        role: 'room_admin',
        organization: membershipOrg,
        isGuest: user && user.licenseTier === 'guest'
      })
    });
  } catch (err) {
    console.error('Create room error', err);
    res.status(500).json({ error: 'Unable to create room' });
  }
});

app.get('/api/rooms/:roomId', requireAuth, async (req, res) => {
  try {
    const { room, membership } = await loadRoomWithMembership(req.params.roomId, req.auth.uid);
    if (!room || !membership) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const summaries = await buildRoomSummaries([room._id]);
    const summary = summaries.get(room._id.toString());

    res.json({ ok: true, room: mergeRoomWithSummary(serializeRoom(room, membership), summary) });
  } catch (err) {
    console.error('Get room error', err);
    res.status(500).json({ error: 'Unable to fetch room' });
  }
});

app.get('/api/rooms/:roomId/issues', requireAuth, async (req, res) => {
  try {
    const { room, membership } = await loadRoomWithMembership(req.params.roomId, req.auth.uid);
    if (!room || !membership) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const issues = await EngagementRoomIssue.find({ room: room._id }).sort({ createdAt: -1 });
    res.json({ ok: true, issues: issues.map(serializeIssue) });
  } catch (err) {
    console.error('List issues error', err);
    res.status(500).json({ error: 'Unable to list issues' });
  }
});

app.post('/api/rooms/:roomId/issues', requireAuth, validateBody(issueCreateSchema), async (req, res) => {
  try {
    const { room, membership } = await loadRoomWithMembership(req.params.roomId, req.auth.uid);
    if (!room || !membership) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (!hasRoomRole(membership, 'editor')) {
      return res.status(403).json({ error: 'Insufficient room role.' });
    }

    const payload = req.validatedBody;
    const issue = await EngagementRoomIssue.create({
      room: room._id,
      title: payload.title,
      description: payload.description,
      status: payload.status || 'not_started',
      assignees: payload.assignees || [],
      dueDate: payload.dueDate,
      notes: payload.notes,
      priority: payload.priority || 'medium',
      createdBy: req.auth.uid
    });

    room.lastActivityAt = new Date();
    await room.save();

    res.status(201).json({ ok: true, issue: serializeIssue(issue) });
  } catch (err) {
    console.error('Create issue error', err);
    res.status(500).json({ error: 'Unable to create issue' });
  }
});

app.patch('/api/rooms/:roomId/issues/:issueId', requireAuth, validateBody(issueUpdateSchema), async (req, res) => {
  try {
    if (!isValidObjectId(req.params.issueId)) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    const { room, membership } = await loadRoomWithMembership(req.params.roomId, req.auth.uid);
    if (!room || !membership) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (!hasRoomRole(membership, 'editor')) {
      return res.status(403).json({ error: 'Insufficient room role.' });
    }

    const issue = await EngagementRoomIssue.findOne({ _id: req.params.issueId, room: room._id });
    if (!issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    const payload = req.validatedBody;
    ['title', 'description', 'status', 'notes', 'priority'].forEach(field => {
      if (payload[field] !== undefined) {
        issue[field] = payload[field];
      }
    });
    if (payload.assignees !== undefined) issue.assignees = payload.assignees;
    if (payload.dueDate !== undefined) issue.dueDate = payload.dueDate;

    await issue.save();

    room.lastActivityAt = new Date();
    await room.save();

    res.json({ ok: true, issue: serializeIssue(issue) });
  } catch (err) {
    console.error('Update issue error', err);
    res.status(500).json({ error: 'Unable to update issue' });
  }
});

app.get('/api/rooms/:roomId/messages', requireAuth, async (req, res) => {
  try {
    const { room, membership } = await loadRoomWithMembership(req.params.roomId, req.auth.uid);
    if (!room || !membership) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const messages = await EngagementRoomMessage.find({ room: room._id }).sort({ createdAt: -1 });
    res.json({ ok: true, messages: messages.map(serializeMessage) });
  } catch (err) {
    console.error('List room messages error', err);
    res.status(500).json({ error: 'Unable to list messages' });
  }
});

app.post(
  '/api/rooms/:roomId/messages',
  requireAuth,
  validateBody(messageCreateSchema),
  async (req, res) => {
    try {
      const { room, membership } = await loadRoomWithMembership(req.params.roomId, req.auth.uid);
      if (!room || !membership) {
        return res.status(404).json({ error: 'Room not found' });
      }

      const payload = req.validatedBody;
      const message = await EngagementRoomMessage.create({
        room: room._id,
        author: req.auth.uid,
        body: payload.body,
        type: payload.type || 'message',
        metadata: payload.metadata || {}
      });

      room.lastActivityAt = new Date();
      await room.save();

      res.status(201).json({ ok: true, message: serializeMessage(message) });
    } catch (err) {
      console.error('Create room message error', err);
      res.status(500).json({ error: 'Unable to create message' });
    }
  }
);

app.get('/api/rooms/:roomId/deliverables', requireAuth, async (req, res) => {
  try {
    const { room, membership } = await loadRoomWithMembership(req.params.roomId, req.auth.uid);
    if (!room || !membership) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const deliverables = await EngagementRoomDeliverable.find({ room: room._id }).sort({ createdAt: -1 });
    res.json({ ok: true, deliverables: deliverables.map(serializeDeliverable) });
  } catch (err) {
    console.error('List deliverables error', err);
    res.status(500).json({ error: 'Unable to list deliverables' });
  }
});

app.post(
  '/api/rooms/:roomId/deliverables',
  requireAuth,
  validateBody(deliverableCreateSchema),
  async (req, res) => {
    try {
      const { room, membership } = await loadRoomWithMembership(req.params.roomId, req.auth.uid);
      if (!room || !membership) {
        return res.status(404).json({ error: 'Room not found' });
      }

      if (!hasRoomRole(membership, 'editor')) {
        return res.status(403).json({ error: 'Insufficient room role.' });
      }

      const payload = req.validatedBody;

      const ownerMembership = await EngagementRoomMembership.findOne({ room: room._id, user: payload.owner });
      if (!ownerMembership) {
        return res.status(400).json({ error: 'Owner must be a room member.' });
      }

      if (payload.relatedIssues && payload.relatedIssues.length > 0) {
        const relatedCount = await EngagementRoomIssue.countDocuments({
          _id: { $in: payload.relatedIssues },
          room: room._id
        });
        if (relatedCount !== payload.relatedIssues.length) {
          return res.status(400).json({ error: 'Related issues must belong to the room.' });
        }
      }

      const deliverable = await EngagementRoomDeliverable.create({
        room: room._id,
        title: payload.title,
        description: payload.description,
        status: payload.status || 'not_started',
        owner: payload.owner,
        relatedIssues: payload.relatedIssues || [],
        dueDate: payload.dueDate,
        createdBy: req.auth.uid
      });

      room.lastActivityAt = new Date();
      await room.save();

      res.status(201).json({ ok: true, deliverable: serializeDeliverable(deliverable) });
    } catch (err) {
      console.error('Create deliverable error', err);
      res.status(500).json({ error: 'Unable to create deliverable' });
    }
  }
);

app.patch(
  '/api/rooms/:roomId/deliverables/:deliverableId',
  requireAuth,
  validateBody(deliverableUpdateSchema),
  async (req, res) => {
    try {
      if (!isValidObjectId(req.params.deliverableId)) {
        return res.status(404).json({ error: 'Deliverable not found' });
      }

      const { room, membership } = await loadRoomWithMembership(req.params.roomId, req.auth.uid);
      if (!room || !membership) {
        return res.status(404).json({ error: 'Room not found' });
      }

      if (!hasRoomRole(membership, 'editor')) {
        return res.status(403).json({ error: 'Insufficient room role.' });
      }

      const deliverable = await EngagementRoomDeliverable.findOne({
        _id: req.params.deliverableId,
        room: room._id
      });
      if (!deliverable) {
        return res.status(404).json({ error: 'Deliverable not found' });
      }

      const payload = req.validatedBody;

      if (payload.owner) {
        const ownerMembership = await EngagementRoomMembership.findOne({ room: room._id, user: payload.owner });
        if (!ownerMembership) {
          return res.status(400).json({ error: 'Owner must be a room member.' });
        }
      }

      if (payload.relatedIssues && payload.relatedIssues.length > 0) {
        const relatedCount = await EngagementRoomIssue.countDocuments({
          _id: { $in: payload.relatedIssues },
          room: room._id
        });
        if (relatedCount !== payload.relatedIssues.length) {
          return res.status(400).json({ error: 'Related issues must belong to the room.' });
        }
      }

      ['title', 'description', 'status', 'owner'].forEach(field => {
        if (payload[field] !== undefined) {
          deliverable[field] = payload[field];
        }
      });
      if (payload.relatedIssues !== undefined) deliverable.relatedIssues = payload.relatedIssues;
      if (payload.dueDate !== undefined) deliverable.dueDate = payload.dueDate;

      await deliverable.save();

      room.lastActivityAt = new Date();
      await room.save();

      res.json({ ok: true, deliverable: serializeDeliverable(deliverable) });
    } catch (err) {
      console.error('Update deliverable error', err);
      res.status(500).json({ error: 'Unable to update deliverable' });
    }
  }
);

app.post(
  '/api/rooms/:roomId/issues/:issueId/comments',
  requireAuth,
  validateBody(issueCommentCreateSchema),
  async (req, res) => {
    try {
      if (!isValidObjectId(req.params.issueId)) {
        return res.status(404).json({ error: 'Issue not found' });
      }

      const { room, membership } = await loadRoomWithMembership(req.params.roomId, req.auth.uid);
      if (!room || !membership) {
        return res.status(404).json({ error: 'Room not found' });
      }

      const issue = await EngagementRoomIssue.findOne({ _id: req.params.issueId, room: room._id });
      if (!issue) {
        return res.status(404).json({ error: 'Issue not found' });
      }

      const payload = req.validatedBody;

      const comment = await EngagementRoomIssueComment.create({
        room: room._id,
        issue: issue._id,
        author: req.auth.uid,
        body: payload.body
      });

      room.lastActivityAt = new Date();
      await room.save();

      res.status(201).json({ ok: true, comment: serializeIssueComment(comment) });
    } catch (err) {
      console.error('Create issue comment error', err);
      res.status(500).json({ error: 'Unable to create issue comment' });
    }
  }
);

app.get('/api/rooms/:roomId/files', requireAuth, async (req, res) => {
  try {
    const { room, membership } = await loadRoomWithMembership(req.params.roomId, req.auth.uid);
    if (!room || !membership) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const files = await EngagementRoomFile.find({ room: room._id })
      .populate('currentVersion')
      .sort({ createdAt: -1 });

    res.json({ ok: true, files: files.map(file => serializeFile(file, file.currentVersion)) });
  } catch (err) {
    console.error('List room files error', err);
    res.status(500).json({ error: 'Unable to list files' });
  }
});

app.post('/api/rooms/:roomId/files', requireAuth, validateBody(fileCreateSchema), async (req, res) => {
  try {
    const { room, membership } = await loadRoomWithMembership(req.params.roomId, req.auth.uid);
    if (!room || !membership) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (!hasRoomRole(membership, 'editor')) {
      return res.status(403).json({ error: 'Insufficient room role.' });
    }

    const payload = req.validatedBody;

    let storageKey = payload.storageKey || null;
    if (!storageKey && payload.base64) {
      storageKey = await saveBase64ToStorage(payload.base64, payload.name);
    }

    const file = await EngagementRoomFile.create({
      room: room._id,
      name: payload.name,
      mimeType: payload.mimeType,
      createdBy: req.auth.uid
    });

    const version = await EngagementRoomFileVersion.create({
      file: file._id,
      storageKey: storageKey || `placeholder-${file._id.toString()}`,
      sizeBytes: payload.sizeBytes,
      uploadedBy: req.auth.uid
    });

    file.currentVersion = version._id;
    await file.save();

    room.lastActivityAt = new Date();
    await room.save();

    res.status(201).json({ ok: true, file: serializeFile(file, version) });
  } catch (err) {
    console.error('Create room file error', err);
    res.status(500).json({ error: 'Unable to create file' });
  }
});

app.get('/api/rooms/:roomId/files/:fileId', requireAuth, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.fileId)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const { room, membership } = await loadRoomWithMembership(req.params.roomId, req.auth.uid);
    if (!room || !membership) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const file = await EngagementRoomFile.findOne({ _id: req.params.fileId, room: room._id }).populate('currentVersion');
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const versions = await EngagementRoomFileVersion.find({ file: file._id }).sort({ createdAt: -1 });
    const comments = await EngagementRoomFileComment.find({ file: file._id }).sort({ createdAt: -1 });

    res.json({
      ok: true,
      file: serializeFile(file, file.currentVersion),
      versions: versions.map(serializeFileVersion),
      comments: comments.map(serializeFileComment)
    });
  } catch (err) {
    console.error('Get room file error', err);
    res.status(500).json({ error: 'Unable to fetch file' });
  }
});

app.get('/api/rooms/:roomId/files/:fileId/download', requireAuth, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.fileId)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const { room, membership } = await loadRoomWithMembership(req.params.roomId, req.auth.uid);
    if (!room || !membership) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const file = await EngagementRoomFile.findOne({ _id: req.params.fileId, room: room._id }).populate('currentVersion');
    if (!file || !file.currentVersion) {
      return res.status(404).json({ error: 'File not found' });
    }

    const version = file.currentVersion;
    const storagePath = resolveStoragePath(version.storageKey);
    if (!storagePath || !fs.existsSync(storagePath)) {
      return res.status(404).json({ error: 'File content not found' });
    }

    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);

    const stream = fs.createReadStream(storagePath);
    stream.on('error', err => {
      console.error('File download stream error', err);
      res.status(500).end();
    });
    stream.pipe(res);
  } catch (err) {
    console.error('Download room file error', err);
    res.status(500).json({ error: 'Unable to download file' });
  }
});

app.post(
  '/api/rooms/:roomId/files/:fileId/comments',
  requireAuth,
  validateBody(fileCommentSchema),
  async (req, res) => {
    try {
      if (!isValidObjectId(req.params.fileId)) {
        return res.status(404).json({ error: 'File not found' });
      }

      const { room, membership } = await loadRoomWithMembership(req.params.roomId, req.auth.uid);
      if (!room || !membership) {
        return res.status(404).json({ error: 'Room not found' });
      }

      const file = await EngagementRoomFile.findOne({ _id: req.params.fileId, room: room._id });
      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      const payload = req.validatedBody;
      let version = null;
      if (payload.version) {
        version = await EngagementRoomFileVersion.findOne({ _id: payload.version, file: file._id });
        if (!version) {
          return res.status(400).json({ error: 'Version does not belong to the file.' });
        }
      }

      const comment = await EngagementRoomFileComment.create({
        file: file._id,
        version: version ? version._id : undefined,
        room: room._id,
        author: req.auth.uid,
        body: payload.body
      });

      room.lastActivityAt = new Date();
      await room.save();

      res.status(201).json({ ok: true, comment: serializeFileComment(comment) });
    } catch (err) {
      console.error('Create file comment error', err);
      res.status(500).json({ error: 'Unable to add comment' });
    }
  }
);

app.post(
  '/api/rooms/:roomId/files/:fileId/validate',
  requireAuth,
  validateBody(fileValidationSchema),
  async (req, res) => {
    try {
      if (!isValidObjectId(req.params.fileId)) {
        return res.status(404).json({ error: 'File not found' });
      }

      const { room, membership } = await loadRoomWithMembership(req.params.roomId, req.auth.uid);
      if (!room || !membership) {
        return res.status(404).json({ error: 'Room not found' });
      }

      if (!hasRoomRole(membership, 'editor')) {
        return res.status(403).json({ error: 'Insufficient room role.' });
      }

      const file = await EngagementRoomFile.findOne({ _id: req.params.fileId, room: room._id }).populate('currentVersion');
      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      const payload = req.validatedBody;
      let version = file.currentVersion;
      if (payload.version) {
        version = await EngagementRoomFileVersion.findOne({ _id: payload.version, file: file._id });
      }
      if (!version) {
        return res.status(404).json({ error: 'File version not found' });
      }

      const recentComments = await EngagementRoomFileComment.find({ file: file._id })
        .sort({ createdAt: -1 })
        .limit(5);

      const promptLines = [
        `Room: ${room.title || room._id.toString()}`,
        `File: ${file.name} (${file.mimeType})`,
        `Version: ${version._id.toString()} size ${version.sizeBytes} bytes`,
        payload.context ? `Additional context: ${payload.context}` : null,
        recentComments.length > 0
          ? `Recent comments: ${recentComments.map(c => c.body).join(' | ')}`
          : null
      ].filter(Boolean);

      const systemPrompt = [
        'You are an agreement and statement of work reviewer.',
        'Return a concise JSON object with keys summary, risks, missingItems, and recommendations.',
        'Risks and missingItems should be arrays of short bullet strings.'
      ].join('\n');

      const { content } = await callOpenAIJson(systemPrompt, promptLines.join('\n'), 0.2);
      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch (parseErr) {
        console.error('AI validation parse error', parseErr, content);
        return res.status(500).json({ error: 'AI validation could not be parsed' });
      }

      res.json({ ok: true, validation: parsed });
    } catch (err) {
      console.error('File validation error', err);
      res.status(500).json({ error: 'Unable to validate file' });
    }
  }
);

app.get('/api/rooms/:roomId/members', requireAuth, async (req, res) => {
  try {
    const { room, membership } = await loadRoomWithMembership(req.params.roomId, req.auth.uid);
    if (!room || !membership) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const members = await EngagementRoomMembership.find({ room: room._id })
      .sort({ createdAt: 1 })
      .populate('user', 'name email licenseTier');

    res.json({ ok: true, members: members.map(serializeRoomMembership) });
  } catch (err) {
    console.error('List room members error', err);
    res.status(500).json({ error: 'Unable to list room members' });
  }
});

app.post(
  '/api/rooms/:roomId/members',
  requireAuth,
  validateBody(roomMembershipCreateSchema),
  async (req, res) => {
    try {
      const { room, membership } = await loadRoomWithMembership(req.params.roomId, req.auth.uid);
      if (!room || !membership) {
        return res.status(404).json({ error: 'Room not found' });
      }

      if (!hasRoomRole(membership, 'room_admin') || membership.isGuest) {
        return res.status(403).json({ error: 'Only non-guest room admins can manage members.' });
      }

      const payload = req.validatedBody;
      if (!isRoomOrganization(room, payload.organization)) {
        return res.status(400).json({ error: 'Organization must match the room vendor or buyer.' });
      }

      const targetUser = await User.findById(payload.userId);
      if (!targetUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      let roomMembership = await EngagementRoomMembership.findOne({ room: room._id, user: targetUser._id });
      const isNew = !roomMembership;
      if (!roomMembership) {
        roomMembership = new EngagementRoomMembership({
          room: room._id,
          user: targetUser._id,
          organization: payload.organization
        });
      }

      roomMembership.role = payload.role;
      roomMembership.organization = payload.organization;
      roomMembership.isGuest = targetUser.licenseTier === 'guest';
      await roomMembership.save();

      res.status(isNew ? 201 : 200).json({ ok: true, member: serializeRoomMembership(roomMembership) });
    } catch (err) {
      console.error('Add room member error', err);
      res.status(500).json({ error: 'Unable to add room member' });
    }
  }
);

app.delete('/api/rooms/:roomId/members/:userId', requireAuth, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.userId)) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const { room, membership } = await loadRoomWithMembership(req.params.roomId, req.auth.uid);
    if (!room || !membership) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (!hasRoomRole(membership, 'room_admin') || membership.isGuest) {
      return res.status(403).json({ error: 'Only non-guest room admins can remove members.' });
    }

    const targetMembership = await EngagementRoomMembership.findOne({ room: room._id, user: req.params.userId });
    if (!targetMembership) {
      return res.status(404).json({ error: 'Member not found' });
    }

    if (targetMembership.role === 'room_admin') {
      const otherAdmins = await EngagementRoomMembership.countDocuments({
        room: room._id,
        role: 'room_admin',
        _id: { $ne: targetMembership._id }
      });
      if (otherAdmins === 0) {
        return res.status(400).json({ error: 'At least one room admin is required.' });
      }
    }

    await targetMembership.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    console.error('Remove room member error', err);
    res.status(500).json({ error: 'Unable to remove room member' });
  }
});

app.get('/api/rooms/:roomId/invites', requireAuth, async (req, res) => {
  try {
    const { room, membership } = await loadRoomWithMembership(req.params.roomId, req.auth.uid);
    if (!room || !membership) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (!hasRoomRole(membership, 'room_admin') || membership.isGuest) {
      return res.status(403).json({ error: 'Only non-guest room admins can view invites.' });
    }

    const invites = await EngagementRoomInvite.find({ room: room._id }).sort({ createdAt: -1 });
    res.json({ ok: true, invites: invites.map(serializeRoomInvite) });
  } catch (err) {
    console.error('List room invites error', err);
    res.status(500).json({ error: 'Unable to list invites' });
  }
});

app.post(
  '/api/rooms/:roomId/invites',
  requireAuth,
  validateBody(roomInviteCreateSchema),
  async (req, res) => {
    try {
      const { room, membership } = await loadRoomWithMembership(req.params.roomId, req.auth.uid);
      if (!room || !membership) {
        return res.status(404).json({ error: 'Room not found' });
      }

      if (!hasRoomRole(membership, 'room_admin') || membership.isGuest) {
        return res.status(403).json({ error: 'Only non-guest room admins can create invites.' });
      }

      const payload = req.validatedBody;
      if (!isRoomOrganization(room, payload.organization)) {
        return res.status(400).json({ error: 'Organization must match the room vendor or buyer.' });
      }

      const invite = await EngagementRoomInvite.create({
        room: room._id,
        email: payload.email.toLowerCase(),
        organization: payload.organization,
        role: payload.role,
        invitedBy: req.auth.uid,
        status: 'pending',
        isGuestInvite: Boolean(payload.isGuestInvite)
      });

      res.status(201).json({ ok: true, invite: serializeRoomInvite(invite) });
    } catch (err) {
      console.error('Create room invite error', err);
      res.status(500).json({ error: 'Unable to create invite' });
    }
  }
);

app.post('/api/room-invites/:token/accept', requireAuth, async (req, res) => {
  try {
    const token = req.params.token;
    if (!token) return res.status(404).json({ error: 'Invite not found' });

    const invite = await EngagementRoomInvite.findOne({ token });
    if (!invite || invite.status !== 'pending') {
      return res.status(404).json({ error: 'Invite not found or already used' });
    }

    const user = await User.findById(req.auth.uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if ((invite.email || '').toLowerCase() !== (user.email || '').toLowerCase()) {
      return res.status(403).json({ error: 'Invite email does not match your account.' });
    }

    const room = await EngagementRoom.findById(invite.room);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (!isRoomOrganization(room, invite.organization)) {
      return res.status(400).json({ error: 'Invite organization does not match room.' });
    }

    if (invite.isGuestInvite && user.licenseTier !== 'guest') {
      user.licenseTier = 'guest';
      await user.save();
    }

    let membership = await EngagementRoomMembership.findOne({ room: room._id, user: user._id });
    if (!membership) {
      membership = new EngagementRoomMembership({ room: room._id, user: user._id, organization: invite.organization });
    }

    membership.role = invite.role;
    membership.organization = invite.organization;
    membership.isGuest = user.licenseTier === 'guest' || invite.isGuestInvite;
    await membership.save();

    invite.status = 'accepted';
    await invite.save();

    res.json({ ok: true, membership: serializeRoomMembership(membership) });
  } catch (err) {
    console.error('Accept invite error', err);
    res.status(500).json({ error: 'Unable to accept invite' });
  }
});

app.post('/api/rooms/:roomId/ai/summary', requireAuth, validateBody(aiSummarySchema), async (req, res) => {
  try {
    const { room, membership } = await loadRoomWithMembership(req.params.roomId, req.auth.uid);
    if (!room || !membership) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const { timeWindowHours } = req.validatedBody;
    const since = new Date(Date.now() - timeWindowHours * 60 * 60 * 1000);

    const [messages, issues, deliverables] = await Promise.all([
      EngagementRoomMessage.find({ room: room._id, createdAt: { $gte: since } })
        .sort({ createdAt: -1 })
        .limit(50),
      EngagementRoomIssue.find({ room: room._id }).sort({ createdAt: -1 }).limit(50),
      EngagementRoomDeliverable.find({ room: room._id }).sort({ createdAt: -1 }).limit(50)
    ]);

    const contextLines = [
      `Room title: ${room.title}`,
      `Messages: ${messages.map(m => m.body).join(' | ')}`,
      `Issues: ${issues.map(i => `[${i.status}] ${i.title}`).join(' | ')}`,
      `Deliverables: ${deliverables.map(d => `[${d.status}] ${d.title}`).join(' | ')}`
    ];

    const systemPrompt = [
      'You are a room collaboration copilot.',
      'Respond with JSON containing summary (string), highlights (string array), risks (string array), and nextSteps (string array).'
    ].join('\n');

    const { content } = await callOpenAIJson(systemPrompt, contextLines.join('\n'));
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      console.error('AI summary parse error', err, content);
      return res.status(500).json({ error: 'Unable to parse AI summary' });
    }

    res.json({ ok: true, summary: parsed });
  } catch (err) {
    console.error('AI summary error', err);
    res.status(500).json({ error: 'Unable to generate summary' });
  }
});

app.post(
  '/api/rooms/:roomId/ai/status-report',
  requireAuth,
  validateBody(aiStatusReportSchema),
  async (req, res) => {
    try {
      const { room, membership } = await loadRoomWithMembership(req.params.roomId, req.auth.uid);
      if (!room || !membership) {
        return res.status(404).json({ error: 'Room not found' });
      }

      const [issues, deliverables] = await Promise.all([
        EngagementRoomIssue.find({ room: room._id }).sort({ createdAt: -1 }).limit(50),
        EngagementRoomDeliverable.find({ room: room._id }).sort({ createdAt: -1 }).limit(50)
      ]);

      const audience = req.validatedBody.audience;
      const contextLines = [
        `Audience: ${audience}`,
        `Issues: ${issues.map(i => `[${i.status}] ${i.title}`).join(' | ')}`,
        `Deliverables: ${deliverables.map(d => `[${d.status}] ${d.title}`).join(' | ')}`
      ];

      const systemPrompt = [
        'You are a program manager drafting a concise status report.',
        'Return JSON with headline (string), overallStatus (on_track|at_risk|off_track),',
        'completed (string array), inProgress (string array), blockers (string array), and recommendedActions (string array).'
      ].join('\n');

      const { content } = await callOpenAIJson(systemPrompt, contextLines.join('\n'));
      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch (err) {
        console.error('AI status report parse error', err, content);
        return res.status(500).json({ error: 'Unable to parse status report' });
      }

      res.json({ ok: true, report: parsed });
    } catch (err) {
      console.error('Status report error', err);
      res.status(500).json({ error: 'Unable to generate status report' });
    }
  }
);

app.post(
  '/api/rooms/:roomId/ai/issues-grooming',
  requireAuth,
  validateBody(aiIssuesGroomingSchema),
  async (req, res) => {
    try {
      const { room, membership } = await loadRoomWithMembership(req.params.roomId, req.auth.uid);
      if (!room || !membership) {
        return res.status(404).json({ error: 'Room not found' });
      }

      const issues = await EngagementRoomIssue.find({ room: room._id })
        .sort({ updatedAt: -1 })
        .limit(req.validatedBody.limit || 30);

      const contextLines = [
        req.validatedBody.focus ? `Focus: ${req.validatedBody.focus}` : null,
        `Issues: ${issues.map(i => `[${i.status}] ${i.title}`).join(' | ')}`
      ].filter(Boolean);

      const systemPrompt = [
        'You are an agile coach helping prioritise issues.',
        'Return JSON with priorities (array of strings), risks (array of strings), and recommendations (array of strings).'
      ].join('\n');

      const { content } = await callOpenAIJson(systemPrompt, contextLines.join('\n'));
      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch (err) {
        console.error('Issues grooming parse error', err, content);
        return res.status(500).json({ error: 'Unable to parse issues grooming result' });
      }

      res.json({ ok: true, grooming: parsed });
    } catch (err) {
      console.error('Issues grooming error', err);
      res.status(500).json({ error: 'Unable to generate issues grooming insights' });
    }
  }
);

app.post(
  '/api/rooms/:roomId/ai/renewal-insights',
  requireAuth,
  validateBody(aiRenewalInsightsSchema),
  async (req, res) => {
    try {
      const { room, membership } = await loadRoomWithMembership(req.params.roomId, req.auth.uid);
      if (!room || !membership) {
        return res.status(404).json({ error: 'Room not found' });
      }

      const [issues, deliverables, messages] = await Promise.all([
        EngagementRoomIssue.find({ room: room._id }).sort({ updatedAt: -1 }).limit(30),
        EngagementRoomDeliverable.find({ room: room._id }).sort({ updatedAt: -1 }).limit(30),
        EngagementRoomMessage.find({ room: room._id }).sort({ createdAt: -1 }).limit(30)
      ]);

      const contextLines = [
        req.validatedBody.segment ? `Customer segment: ${req.validatedBody.segment}` : null,
        `Issues: ${issues.map(i => `[${i.status}] ${i.title}`).join(' | ')}`,
        `Deliverables: ${deliverables.map(d => `[${d.status}] ${d.title}`).join(' | ')}`,
        `Recent notes: ${messages.map(m => m.body).join(' | ')}`
      ].filter(Boolean);

      const systemPrompt = [
        'You are a renewals strategist identifying expansion and risk signals.',
        'Return JSON with summary (string), renewalSignals (array of strings), riskFlags (array of strings), and recommendations (array of strings).'
      ].join('\n');

      const { content } = await callOpenAIJson(systemPrompt, contextLines.join('\n'));
      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch (err) {
        console.error('Renewal insights parse error', err, content);
        return res.status(500).json({ error: 'Unable to parse renewal insights' });
      }

      res.json({ ok: true, insights: parsed });
    } catch (err) {
      console.error('Renewal insights error', err);
      res.status(500).json({ error: 'Unable to generate renewal insights' });
    }
  }
);

async function loadProcurePathUser(req, res) {
  const user = req.requestingUser || (await User.findById(req.auth.uid));
  if (!user) {
    res.status(404).json({ error: 'Not found' });
    return null;
  }

  return user;
}

async function loadRevenueForgeUser(req, res) {
  const user = req.requestingUser || (await User.findById(req.auth.uid));
  if (!user) {
    res.status(404).json({ error: 'Not found' });
    return null;
  }

  return user;
}

function calculateRevenueStats(account) {
  const opportunities = account.opportunities || [];
  const totalValue = opportunities.reduce((acc, opp) => acc + (opp.value || 0), 0);
  const totalMeetings = opportunities.reduce((acc, opp) => acc + (opp.meetingNotes?.length || 0), 0);
  const totalNotes = opportunities.reduce((acc, opp) => {
    const collaborationNotes = [
      opp.summary,
      opp.qualification?.notes,
      opp.qualification?.blockers,
      opp.qualification?.framework,
      opp.architecture?.currentState,
      opp.architecture?.proposedState
    ].filter(Boolean);
    return acc + collaborationNotes.length;
  }, 0);

  return {
    opportunityCount: opportunities.length,
    totalValue,
    meetingCount: totalMeetings,
    noteCount: totalNotes
  };
}

async function loadBuyerContext(req, res) {
  const user = req.requestingUser || (req.auth?.uid ? await User.findById(req.auth.uid) : null);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return null;
  }

  const orgId = req.auth?.orgId || user.defaultOrganization;
  let organization = null;
  let orgContext = null;

  if (orgId) {
    const org = await Organization.findById(orgId);
    if (org) {
      const membership = await OrganizationMembership.findOne({
        organization: org._id,
        user: user._id,
        status: 'active'
      });

      if (membership) {
        organization = org;
        orgContext = {
          id: org._id.toString(),
          name: org.name,
          tier: org.tier,
          orgType: org.orgType || 'both',
          role: membership.role
        };
      }
    }
  }

  const effectiveLicense = computeEffectiveLicense(user, orgContext);
  const entitlement = getPlatformEntitlement(user, orgContext, 'valuesphere');
  const canUseBuyerMode = user.licenseTier !== 'guest' && entitlement.allowed;
  const productAccess = Array.isArray(organization?.productAccess)
    ? organization.productAccess
    : Array.isArray(organization?.platformAccess)
      ? organization.platformAccess
      : [];

  const isBusinessBuyerWithProcurePath =
    effectiveLicense.tier === 'business' &&
    organization &&
    organization.tier === 'business' &&
    (organization.orgType === 'buyer' || organization.orgType === 'both') &&
    productAccess.includes('procurepath');

  return { user, organization, effectiveLicense, canUseBuyerMode, isBusinessBuyerWithProcurePath };
}

function serializeBuyerAssessment(assessment) {
  return {
    id: assessment._id.toString(),
    vendorName: assessment.vendorName,
    title: assessment.title || '',
    dimensions: Array.isArray(assessment.dimensions) ? assessment.dimensions : [],
    summary: assessment.summary || '',
    tags: Array.isArray(assessment.tags) ? assessment.tags : [],
    createdAt: assessment.createdAt,
    updatedAt: assessment.updatedAt
  };
}

app.get('/api/valuesphere/buyer/vendors', requireAuth, requirePlatformAccess('valuesphere'), async (req, res) => {
  try {
    const context = await loadBuyerContext(req, res);
    if (!context) return;

    if (context.isBusinessBuyerWithProcurePath && context.organization) {
      const vendors = await ProcurementVendor.find({ organization: context.organization._id })
        .sort({ updatedAt: -1 })
        .lean();

      const payload = vendors.map(vendor => ({
        id: vendor._id.toString(),
        name: vendor.name,
        category: vendor.category || null,
        spend: typeof vendor.annualSpend === 'number' ? vendor.annualSpend : null,
        renewalDate: vendor.renewalDate ? vendor.renewalDate.toISOString() : null,
        riskLevel: vendor.riskLevel || null
      }));

      return res.json({ ok: true, vendors: payload });
    }

    return res.json({ ok: true, vendors: [] });
  } catch (err) {
    console.error('Buyer vendor list error', err);
    return res.status(500).json({ error: 'Unable to load vendors' });
  }
});

app.get('/api/valuesphere/buyer/assessments', requireAuth, requirePlatformAccess('valuesphere'), async (req, res) => {
  try {
    const context = await loadBuyerContext(req, res);
    if (!context) return;

    const { vendorId } = req.query;
    let query = {};

    if (context.isBusinessBuyerWithProcurePath && context.organization) {
      query.organization = context.organization._id;
      if (vendorId) {
        if (!mongoose.Types.ObjectId.isValid(vendorId)) {
          return res.status(400).json({ error: 'Invalid vendorId' });
        }
        query.procurementVendor = vendorId;
      }
    } else {
      query = { organization: null, createdBy: context.user._id };
    }

    const assessments = await BuyerValueAssessment.find(query).sort({ updatedAt: -1 });
    return res.json({ ok: true, assessments: assessments.map(serializeBuyerAssessment) });
  } catch (err) {
    console.error('Buyer assessments fetch error', err);
    return res.status(500).json({ error: 'Unable to load buyer assessments' });
  }
});

app.post('/api/valuesphere/buyer/assessments', requireAuth, requirePlatformAccess('valuesphere'), async (req, res) => {
  try {
    const context = await loadBuyerContext(req, res);
    if (!context) return;

    const { vendorId, vendorName, title, dimensions, summary, tags } = req.body || {};

    if (!vendorName || typeof vendorName !== 'string') {
      return res.status(400).json({ error: 'vendorName is required' });
    }

    let procurementVendorId = null;

    if (context.isBusinessBuyerWithProcurePath) {
      if (!context.organization) {
        return res.status(400).json({ error: 'Organization context required' });
      }

      if (vendorId) {
        if (!mongoose.Types.ObjectId.isValid(vendorId)) {
          return res.status(400).json({ error: 'Invalid vendorId' });
        }

        const procurementVendor = await ProcurementVendor.findOne({
          _id: vendorId,
          organization: context.organization._id
        });

        if (!procurementVendor) {
          return res.status(404).json({ error: 'Vendor not found' });
        }

        procurementVendorId = procurementVendor._id;
      }
    }

    const assessment = await BuyerValueAssessment.create({
      organization: context.isBusinessBuyerWithProcurePath && context.organization ? context.organization._id : null,
      procurementVendor: procurementVendorId,
      vendorName,
      title,
      dimensions: Array.isArray(dimensions) ? dimensions : [],
      summary,
      tags: Array.isArray(tags) ? tags : [],
      createdBy: context.user._id
    });

    return res.status(201).json({ ok: true, assessment: serializeBuyerAssessment(assessment) });
  } catch (err) {
    console.error('Buyer assessment create error', err);
    return res.status(500).json({ error: 'Unable to create buyer assessment' });
  }
});

app.patch('/api/valuesphere/buyer/assessments/:id', requireAuth, requirePlatformAccess('valuesphere'), async (req, res) => {
  try {
    const context = await loadBuyerContext(req, res);
    if (!context) return;

    const assessment = await BuyerValueAssessment.findById(req.params.id);
    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    const belongsToOrg = !!assessment.organization;
    if (belongsToOrg) {
      const membership = await OrganizationMembership.findOne({
        organization: assessment.organization,
        user: context.user._id,
        status: 'active'
      });

      if (!membership) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    } else if (assessment.createdBy.toString() !== context.user._id.toString()) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    ['title', 'dimensions', 'summary', 'tags'].forEach(field => {
      if (req.body[field] !== undefined) {
        assessment[field] = field === 'tags' || field === 'dimensions'
          ? Array.isArray(req.body[field])
            ? req.body[field]
            : assessment[field]
          : req.body[field];
      }
    });

    await assessment.save();
    return res.json({ ok: true, assessment: serializeBuyerAssessment(assessment) });
  } catch (err) {
    console.error('Buyer assessment update error', err);
    return res.status(500).json({ error: 'Unable to update buyer assessment' });
  }
});

app.get('/api/procurepath/overview', requireAuth, requirePlatformAccess('procurepath'), async (req, res) => {
  try {
    const user = await loadProcurePathUser(req, res);
    if (!user) return;
    const vendors = await ProcurementVendor.find({ userId: user._id }).lean();

    const totalObjectives = vendors.reduce((acc, vendor) => acc + (vendor.objectives?.length || 0), 0);
    const atRiskVendors = vendors.filter(vendor => vendor.riskLevel === 'high' || vendor.status === 'watchlist').length;
    const upcomingRenewals = vendors.filter(vendor => {
      if (!vendor.renewalDate) return false;
      const diff = new Date(vendor.renewalDate).getTime() - Date.now();
      return diff > 0 && diff < 90 * 24 * 60 * 60 * 1000;
    }).length;

    res.json({
      ok: true,
      overview: {
        totalVendors: vendors.length,
        totalObjectives,
        atRiskVendors,
        upcomingRenewals
      },
      vendors
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to load ProcurePath overview' });
  }
});

app.get('/api/procurepath/vendors', requireAuth, requirePlatformAccess('procurepath'), async (req, res) => {
  try {
    const user = await loadProcurePathUser(req, res);
    if (!user) return;
    const vendors = await ProcurementVendor.find({ userId: user._id }).sort({ updatedAt: -1 }).lean();
    res.json({ ok: true, vendors });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to fetch vendors' });
  }
});

  app.post(
    '/api/procurepath/vendors',
    requireAuth,
    requirePlatformAccess('procurepath'),
    validateBody(procurementVendorSchema),
    async (req, res) => {
      try {
        const user = await loadProcurePathUser(req, res);
        if (!user) return;
        const vendor = await ProcurementVendor.create({ ...req.validatedBody, userId: user._id });
        res.status(201).json({ ok: true, vendor });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Unable to create vendor' });
      }
    }
  );

  app.put(
    '/api/procurepath/vendors/:id',
    requireAuth,
    requirePlatformAccess('procurepath'),
    validateBody(procurementVendorSchema.partial()),
    async (req, res) => {
      try {
        const user = await loadProcurePathUser(req, res);
        if (!user) return;
        const vendor = await ProcurementVendor.findOneAndUpdate(
          { _id: req.params.id, userId: user._id },
          { $set: req.validatedBody },
          { new: true }
        );

        if (!vendor) {
          return res.status(404).json({ error: 'Vendor not found' });
        }

        res.json({ ok: true, vendor });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Unable to update vendor' });
      }
    }
  );

app.post(
  '/api/procurepath/vendors/:id/objectives',
  requireAuth,
  requirePlatformAccess('procurepath'),
  validateBody(procurementObjectiveSchema),
  async (req, res) => {
    try {
      const user = await loadProcurePathUser(req, res);
      if (!user) return;

      const vendor = await ProcurementVendor.findOne({ _id: req.params.id, userId: user._id });
      if (!vendor) return res.status(404).json({ error: 'Vendor not found' });

      vendor.objectives.push(req.validatedBody);
      await vendor.save();
      res.status(201).json({ ok: true, vendor });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Unable to add objective' });
    }
  }
);

app.post(
  '/api/procurepath/vendors/:id/touchpoints',
  requireAuth,
  requirePlatformAccess('procurepath'),
  validateBody(procurementTouchpointSchema),
  async (req, res) => {
    try {
      const user = await loadProcurePathUser(req, res);
      if (!user) return;

      const vendor = await ProcurementVendor.findOne({ _id: req.params.id, userId: user._id });
      if (!vendor) return res.status(404).json({ error: 'Vendor not found' });

      vendor.touchpoints.push(req.validatedBody);
      await vendor.save();
      res.status(201).json({ ok: true, vendor });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Unable to add touchpoint' });
    }
  }
);

app.post('/api/procurepath/ai/playbook', requireAuth, requirePlatformAccess('procurepath'), async (req, res) => {
  try {
    const user = await loadProcurePathUser(req, res);
    if (!user) return;

    if (!OPENAI_API_KEY) {
      return res
        .status(400)
        .json({ error: 'OpenAI API key missing. Add OPENAI_API_KEY to generate AI playbooks.' });
    }

    const { vendorId, goal } = req.body || {};
    if (!vendorId || !goal) {
      return res.status(400).json({ error: 'Provide vendorId and goal to generate a playbook.' });
    }

    const vendor = await ProcurementVendor.findOne({ _id: vendorId, userId: user._id });
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });

    const latestObjectives = (vendor.objectives || []).slice(-3);
    const objectiveSummary = latestObjectives
      .map(obj => `${obj.title} (${obj.status || 'on-track'}) - ${obj.targetMetric || 'Outcome focus'}`)
      .join('; ');

    const touchpointSummary = (vendor.touchpoints || [])
      .slice(-2)
      .map(tp => `${tp.type || 'Touchpoint'}: ${tp.summary}`)
      .join(' | ');

    const prompt = [
      'You are a procurement strategist building a vendor relationship playbook.',
      `Vendor: ${vendor.name} (${vendor.category || 'uncategorised'}). Tier: ${vendor.tier}. Risk: ${vendor.riskLevel}. Health: ${
        vendor.healthScore || 'n/a'
      }. Annual spend: ${vendor.annualSpend || 0}.`,
      `Objectives: ${objectiveSummary || 'No objectives logged yet.'}`,
      `Recent touchpoints: ${touchpointSummary || 'No recent activity recorded.'}`,
      `Goal: ${goal}.`,
      'Return a concise plan with 3-5 actions, KPIs to monitor, and negotiation guardrails.'
    ].join('\n');

    const completion = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an experienced procurement leader who writes crisp action plans.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.4,
        max_tokens: 600
      })
    });

    if (!completion.ok) {
      const error = await completion.text();
      return res.status(500).json({ error: 'OpenAI request failed', details: error });
    }

    const data = await completion.json();
    const message = data.choices?.[0]?.message?.content?.trim();
    res.json({ ok: true, playbook: message || 'No plan generated. Try again with more context.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to generate playbook' });
  }
});

app.get('/api/revenueforge/accounts', requireAuth, requirePlatformAccess('revenueforge'), async (req, res) => {
  try {
    const user = await loadRevenueForgeUser(req, res);
    if (!user) return;
    const accounts = await RevenueAccount.find({ userId: user._id }).sort({ updatedAt: -1 }).lean();
    const enriched = accounts.map(account => ({ ...account, stats: calculateRevenueStats(account) }));
    res.json({ ok: true, accounts: enriched });
  } catch (err) {
    console.error('RevenueForge account listing failed', err);
    res.status(500).json({ error: 'Unable to load RevenueForge accounts' });
  }
});

app.post(
  '/api/revenueforge/accounts',
  requireAuth,
  requirePlatformAccess('revenueforge'),
  validateBody(revenueAccountSchema),
  async (req, res) => {
  try {
    const user = await loadRevenueForgeUser(req, res);
    if (!user) return;
    const account = await RevenueAccount.create({ ...req.validatedBody, userId: user._id });
    res.status(201).json({ ok: true, account, stats: calculateRevenueStats(account) });
  } catch (err) {
    console.error('RevenueForge account create failed', err);
    res.status(500).json({ error: 'Unable to create account' });
  }
  }
);

app.get(
  '/api/revenueforge/accounts/:id',
  requireAuth,
  requirePlatformAccess('revenueforge'),
  async (req, res) => {
  try {
    const user = await loadRevenueForgeUser(req, res);
    if (!user) return;
    const account = await RevenueAccount.findOne({ _id: req.params.id, userId: user._id });
    if (!account) return res.status(404).json({ error: 'Account not found' });
    res.json({ ok: true, account, stats: calculateRevenueStats(account) });
  } catch (err) {
    console.error('RevenueForge account fetch failed', err);
    res.status(500).json({ error: 'Unable to load account' });
  }
  }
);

app.post(
  '/api/revenueforge/accounts/:id/opportunities',
  requireAuth,
  requirePlatformAccess('revenueforge'),
  validateBody(revenueOpportunitySchema),
  async (req, res) => {
    try {
      const user = await loadRevenueForgeUser(req, res);
      if (!user) return;
      const account = await RevenueAccount.findOne({ _id: req.params.id, userId: user._id });
      if (!account) return res.status(404).json({ error: 'Account not found' });
      account.opportunities.push(req.validatedBody);
      await account.save();
      const opportunity = account.opportunities[account.opportunities.length - 1];
      res.status(201).json({ ok: true, opportunity, account, stats: calculateRevenueStats(account) });
    } catch (err) {
      console.error('RevenueForge opportunity create failed', err);
      res.status(500).json({ error: 'Unable to create opportunity' });
    }
  }
);

app.put(
  '/api/revenueforge/accounts/:accountId/opportunities/:opportunityId',
  requireAuth,
  requirePlatformAccess('revenueforge'),
  validateBody(opportunityUpdateSchema),
  async (req, res) => {
    try {
      const user = await loadRevenueForgeUser(req, res);
      if (!user) return;
      const account = await RevenueAccount.findOne({ _id: req.params.accountId, userId: user._id });
      if (!account) return res.status(404).json({ error: 'Account not found' });
      const opportunity = account.opportunities.id(req.params.opportunityId);
      if (!opportunity) return res.status(404).json({ error: 'Opportunity not found' });

      Object.entries(req.validatedBody).forEach(([key, value]) => {
        opportunity[key] = value;
      });

      await account.save();
      res.json({ ok: true, opportunity, account, stats: calculateRevenueStats(account) });
    } catch (err) {
      console.error('RevenueForge opportunity update failed', err);
      res.status(500).json({ error: 'Unable to update opportunity' });
    }
  }
);

app.post(
  '/api/revenueforge/opportunities/:opportunityId/meetings',
  requireAuth,
  requirePlatformAccess('revenueforge'),
  validateBody(meetingNoteSchema),
  async (req, res) => {
    try {
      const user = await loadRevenueForgeUser(req, res);
      if (!user) return;
      const account = await RevenueAccount.findOne({ userId: user._id, 'opportunities._id': req.params.opportunityId });
      if (!account) return res.status(404).json({ error: 'Opportunity not found' });
      const opportunity = account.opportunities.id(req.params.opportunityId);
      if (!opportunity) return res.status(404).json({ error: 'Opportunity not found' });

      const meetingPayload = {
        title: req.validatedBody.title || 'Customer touchpoint',
        occurredAt: req.validatedBody.occurredAt,
        notes: req.validatedBody.notes,
        followUps: req.validatedBody.followUps,
        internalAttendees: req.validatedBody.internalAttendees || [],
        customerAttendees: req.validatedBody.customerAttendees || [],
        transcriptSource: req.validatedBody.transcript ? 'provided' : undefined
      };

      if (req.validatedBody.transcript && OPENAI_API_KEY) {
        try {
          const attendees = [
            req.validatedBody.primaryRep ? `Primary seller: ${req.validatedBody.primaryRep}.` : null,
            meetingPayload.internalAttendees.length
              ? `Internal: ${meetingPayload.internalAttendees.join(', ')}.`
              : null,
            meetingPayload.customerAttendees.length
              ? `Customer: ${meetingPayload.customerAttendees.join(', ')}.`
              : null
          ]
            .filter(Boolean)
            .join(' ');

          const prompt = [
            'You are a revenue strategist producing crisp meeting insights.',
            attendees || 'Meeting attendees were not provided.',
            'Transcript:',
            req.validatedBody.transcript,
            'Return bullet insights for notes, actions, next steps, and sentiment. Keep it concise.'
          ].join('\n');

          const completion = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: 'You are an enterprise account executive assistant.' },
                { role: 'user', content: prompt }
              ],
              temperature: 0.3,
              max_tokens: 700
            })
          });

          if (completion.ok) {
            const data = await completion.json();
            const aiContent = data.choices?.[0]?.message?.content;
            meetingPayload.aiSummary = aiContent || 'AI summary unavailable';
            meetingPayload.aiActions = 'AI generated insights';
          } else {
            const details = await completion.text();
            console.error('OpenAI meeting summary failed', details);
          }
        } catch (aiErr) {
          console.error('OpenAI meeting summary errored', aiErr);
        }
      }

      opportunity.meetingNotes.push(meetingPayload);
      await account.save();
      const meeting = opportunity.meetingNotes[opportunity.meetingNotes.length - 1];
      res.status(201).json({ ok: true, meeting, opportunity, account, stats: calculateRevenueStats(account) });
    } catch (err) {
      console.error('RevenueForge meeting capture failed', err);
      res.status(500).json({ error: 'Unable to capture meeting notes' });
    }
  }
);

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
