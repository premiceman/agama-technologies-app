// Agama Technologies — Backend (Express + MongoDB)
// Serves static frontend from ./public and provides API for auth, assessments, reports, and mock payments.
require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
const ExcelJS = require('exceljs');

const app = express();

// ---- Security & parsers ----
app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ---- CORS ----
const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: function(origin, cb) {
    if (!origin) return cb(null, true);
    if (allowed.length === 0 || allowed.includes(origin)) return cb(null, true);
    return cb(new Error('CORS blocked for origin: ' + origin));
  },
  credentials: true
}));

app.use(morgan('dev'));

// ---- MongoDB ----
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/agama_tech';
mongoose.set('strictQuery', true);
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('❌ MongoDB connection error', err);
    process.exit(1);
  });

// ---- Models ----
const User = require('./models/User');
const Assessment = require('./models/Assessment');
const Project = require('./models/Project');
const Report = require('./models/Report');
const Payment = require('./models/Payment');

// ---- Utils ----
const { requireAuth, issueTokenCookie, clearTokenCookie } = require('./middleware/auth');
const { computeReport } = require('./utils/scoring');
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
  generateAssessmentAssistantReply
} = require('./utils/openai');

function computeProjectAnalyticsSnapshot({
  stage,
  riskAppetite,
  strategicDrivers = [],
  capabilityFocus = [],
  companyProfile = {},
  operatingModel = {}
} = {}) {
  const stageScores = {
    'Discovery & Fit': 42,
    'Mobilising programme': 56,
    'Scaling transformation': 72,
    'Optimising value': 84
  };
  const riskScores = {
    'Conservative': -6,
    'Balanced': 0,
    'Bold innovation': 8
  };
  const base = stageScores[stage] || 40;
  const risk = riskScores[riskAppetite] || 0;
  const driverContribution = Math.min(strategicDrivers.length * 6, 24);
  const focusContribution = Math.min(capabilityFocus.length * 5, 20);
  const readinessScore = Math.max(
    35,
    Math.min(base + risk + driverContribution + focusContribution, 96)
  );

  const narrativeSignals = [
    companyProfile.executiveObjectives,
    companyProfile.narrativeContext,
    companyProfile.complianceDrivers
  ].filter(Boolean).length;
  const governanceSignals = [
    operatingModel.governanceRhythms,
    operatingModel.changeManagement,
    operatingModel.processNotes
  ].filter(Boolean).length;
  const clarityScore = Math.min(45 + narrativeSignals * 12 + governanceSignals * 8, 95);

  const sentiment = readinessScore >= 80
    ? 'Programme is change-ready with strong acceleration potential.'
    : readinessScore >= 60
      ? 'Momentum forming—reinforce governance and stakeholder choreography.'
      : 'Establish foundational guardrails before expanding the programme.';

  return {
    readinessScore,
    clarityScore,
    sentiment,
    driverCount: strategicDrivers.length,
    focusCount: capabilityFocus.length,
    stage,
    riskAppetite
  };
}

// ---- Routes ----
app.get('/api/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

// Auth
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password, company, role, industry } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Missing email/password' });
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

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const user = await User.findOne({ email: (email||'').toLowerCase().trim() });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await user.verifyPassword(password || '');
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = issueTokenCookie(res, { uid: user._id.toString() });
    res.json({ ok: true, user: user.public(), token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  clearTokenCookie(res);
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.auth.uid);
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true, user: user.public() });
});

app.put('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const updates = {};
    const payload = req.body || {};
    ['name', 'company', 'role', 'industry'].forEach(field => {
      if (payload[field] !== undefined) {
        const value = String(payload[field] ?? '').trim();
        updates[field] = value;
      }
    });

    const user = await User.findByIdAndUpdate(req.auth.uid, updates, { new: true });
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true, user: user.public() });
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
      Payment.deleteMany({ userId })
    ]);
    await User.deleteOne({ _id: userId });
    clearTokenCookie(res);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to delete profile' });
  }
});

// Projects
app.get('/api/projects', requireAuth, async (req, res) => {
  const projects = await Project.find({ userId: req.auth.uid }).sort({ updatedAt: -1 });
  res.json({ ok: true, projects: projects.map(project => project.public()) });
});

app.post('/api/projects', requireAuth, async (req, res) => {
  try {
    const {
      name,
      companyDomain,
      industry,
      region,
      companySize,
      headcount,
      stage,
      riskAppetite,
      strategicDrivers = [],
      capabilityFocus = [],
      overview,
      companyProfile = {},
      operatingModel = {},
      techLandscape = {},
      personas = []
    } = req.body || {};

    if (!name || !industry || !region || !companySize) {
      return res.status(400).json({ error: 'Project name, industry, region, and company size are required.' });
    }

    const projectData = {
      userId: req.auth.uid,
      name: String(name).trim().slice(0, 140),
      companyDomain: String(companyDomain || '').trim().slice(0, 160),
      industry,
      region,
      companySize,
      headcount: Number(headcount) || 0,
      stage,
      riskAppetite,
      strategicDrivers: Array.isArray(strategicDrivers) ? strategicDrivers.slice(0, 10) : [],
      capabilityFocus: Array.isArray(capabilityFocus) ? capabilityFocus.slice(0, 12) : [],
      overview: String(overview || '').trim().slice(0, 500),
      companyProfile,
      operatingModel,
      techLandscape,
      personas: Array.isArray(personas) ? personas.slice(0, 12) : []
    };

    projectData.analytics = computeProjectAnalyticsSnapshot(projectData);

    const project = await Project.create(projectData);
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
    res.json({ ok: true, project: project.public() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to load project' });
  }
});

app.put('/api/projects/:id', requireAuth, async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, userId: req.auth.uid });
    if (!project) return res.status(404).json({ error: 'Not found' });

    const updates = req.body || {};
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

    project.analytics = computeProjectAnalyticsSnapshot(project.toObject());

    await project.save();
    res.json({ ok: true, project: project.public() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to update project' });
  }
});

// Assessment catalog & questions
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

app.post('/api/organizations/enrich', requireAuth, async (req, res) => {
  try {
    const {
      query,
      capability: capabilityId = 'security',
      industry,
      fetchDetailsFor
    } = req.body || {};

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

app.post('/api/assessments/follow-up', requireAuth, async (req, res) => {
  try {
    const {
      step,
      capabilityId = 'security',
      answers = {},
      organization = {},
      industry = ''
    } = req.body || {};
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

app.post('/api/assessments/assistant', requireAuth, async (req, res) => {
  try {
    const { message, capabilityId = 'security', draft = {} } = req.body || {};
    if (!message || String(message).trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }
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

// Create assessment -> compute report (partial by default)
app.post('/api/assessments', requireAuth, async (req, res) => {
  try {
    const {
      projectId,
      stage = 'insight',
      assessmentType = 'security',
      vertical: verticalRaw = 'generic',
      companySize = 'SMB',
      region = 'EMEA',
      industry = '',
      strategicDrivers = [],
      organization = {},
      companyProfile = {},
      capabilityFocus = [],
      techLandscape = {},
      personas = [],
      vendorStrategy = {},
      operatingModel = {},
      stakeholderProfile = {},
      investmentProfile = {},
      initiativeTimeline = [],
      architectureUploads = [],
      architectureSignals = {},
      answers = {},
      premiumAnswers = {},
      extendedAnswers = {},
      commandAnswers = {}
    } = req.body || {};

    if (!projectId) {
      return res.status(400).json({ error: 'A project is required before starting an assessment.' });
    }

    const project = await Project.findOne({ _id: projectId, userId: req.auth.uid });
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const stageMap = { free: 'insight', premium: 'strategic' };
    const requestedStage = stageMap[stage] || stage;
    const allowedStages = ['insight', 'strategic', 'command'];
    const safeStage = allowedStages.includes(requestedStage) ? requestedStage : 'insight';
    const safeVertical = String(verticalRaw || 'generic').toLowerCase();
    const vertical = ['generic', 'saas'].includes(safeVertical) ? safeVertical : 'generic';
    const capability = getCapability(assessmentType);

    let organizationIntel = {};
    if (organization?.name) {
      organizationIntel = await fetchOrganizationIntel({
        organization: organization.name,
        assessmentType: capability.name,
        industry: industry || vertical
      });
    }

    const profileIntel = organizationIntel?.profile || {};

    const normaliseList = (value) => {
      if (Array.isArray(value)) return value;
      if (!value) return [];
      return String(value)
        .split(/\n|;|\r|\u2022/g)
        .map(item => item.trim())
        .filter(Boolean)
        .slice(0, 12);
    };

    const enrichedCompanyProfile = {
      ...project.companyProfile,
      ...companyProfile,
      headcount: companyProfile.headcount || profileIntel.headcountEstimate || profileIntel.employeeRange,
      annualRevenue: companyProfile.annualRevenue || project.companyProfile?.annualRevenue || profileIntel.annualRevenueEstimate,
      turnover: companyProfile.turnover || project.companyProfile?.turnover || profileIntel.turnover,
      investmentRounds: normaliseList(companyProfile.investmentRounds || project.companyProfile?.investmentRounds || profileIntel.investmentHighlights),
      keyInitiatives: normaliseList(
        companyProfile.keyInitiatives || project.companyProfile?.keyInitiatives || (profileIntel.keyInitiatives || []).map(k => `${k.name}: ${k.objective || k.description || ''}`)
      ),
      organisationStructure: normaliseList(
        companyProfile.organisationStructure || project.companyProfile?.organisationStructure || (profileIntel.organisationStructure || []).map(o => `${o.function || o.leader}: ${o.remit || ''}`)
      ),
      personaKpis: companyProfile.personaKpis || project.companyProfile?.personaKpis || profileIntel.personaKpis || {},
      discoveryObjectives: normaliseList(
        companyProfile.discoveryObjectives || project.companyProfile?.discoveryObjectives || (profileIntel.discoveryObjectives || []).map(d => `${d.objective || ''}${d.linkedKpis ? ` · KPIs: ${Array.isArray(d.linkedKpis) ? d.linkedKpis.join(', ') : d.linkedKpis}` : ''}${d.timeframe ? ` · ${d.timeframe}` : ''}`)
      )
    };

    const normalizedTimeline = Array.isArray(initiativeTimeline)
      ? initiativeTimeline.slice(0, 10).map(item => ({
          title: String(item?.title || '').slice(0, 160),
          owner: String(item?.owner || '').slice(0, 120),
          timeline: String(item?.timeline || '').slice(0, 80),
          outcome: String(item?.outcome || '').slice(0, 200),
          description: String(item?.description || '').slice(0, 240)
        }))
      : [];

    const sanitizedUploads = Array.isArray(architectureUploads)
      ? architectureUploads.slice(0, 5).map(file => ({
          filename: String(file?.filename || '').slice(0, 140),
          mimeType: String(file?.mimeType || '').slice(0, 80),
          data: typeof file?.data === 'string' ? file.data.slice(0, 2_000_000) : ''
        }))
      : [];

    const sanitizedSignals = Object.fromEntries(
      Object.entries(architectureSignals || {}).map(([key, value]) => [key, String(value || '').slice(0, 1000)])
    );
    if (Array.isArray(profileIntel.architectureSignals)) {
      sanitizedSignals.organisationIntel = profileIntel.architectureSignals.slice(0, 10);
    }
    if (Array.isArray(profileIntel.renewalCalendar)) {
      sanitizedSignals.renewalCalendar = profileIntel.renewalCalendar.slice(0, 10);
    }

    const storedExtendedAnswers =
      safeStage === 'insight'
        ? {}
        : Object.keys(extendedAnswers || {}).length
          ? extendedAnswers
          : Object.keys(premiumAnswers || {}).length
            ? premiumAnswers
            : {};

    const storedPremiumAnswers =
      safeStage === 'strategic' && !Object.keys(extendedAnswers || {}).length
        ? premiumAnswers
        : {};

    const storedCommandAnswers = safeStage === 'command' ? commandAnswers : {};

    const assessment = await Assessment.create({
      userId: req.auth.uid,
      projectId: project._id,
      assessmentType,
      stage: safeStage,
      vertical,
      industry: industry || project.industry,
      companySize: companySize || project.companySize,
      region: region || project.region,
      strategicDrivers: strategicDrivers.length ? strategicDrivers : project.strategicDrivers,
      organization: {
        name: organization?.name || project.companyProfile?.legalName || '',
        extract: organizationIntel.summary || organization?.extract || project.companyProfile?.summary || '',
        intel: organizationIntel
      },
      companyProfile: enrichedCompanyProfile,
      capabilityFocus: capabilityFocus.length ? capabilityFocus : (project.capabilityFocus?.length ? project.capabilityFocus : capability.domains),
      techLandscape,
      vendorStrategy,
      operatingModel: {
        ...project.operatingModel,
        ...operatingModel,
        discoveryObjectives: operatingModel.discoveryObjectives || project.operatingModel?.discoveryObjectives || enrichedCompanyProfile.discoveryObjectives
      },
      stakeholderProfile,
      investmentProfile,
      initiativeTimeline: normalizedTimeline,
      architectureUploads: sanitizedUploads,
      architectureSignals: sanitizedSignals,
      personas: personas.length ? personas : (project.personas?.length ? project.personas : capability.personas),
      answers,
      premiumAnswers: storedPremiumAnswers,
      extendedAnswers: storedExtendedAnswers,
      commandAnswers: storedCommandAnswers,
      projectSnapshot: project.public()
    });

    const reportData = await computeReport({ assessment });
    const report = await Report.create({
      userId: req.auth.uid,
      assessmentId: assessment._id,
      projectId: project._id,
      ...reportData,
      architectureUploads: sanitizedUploads,
      architectureSignals: sanitizedSignals,
      paid: safeStage !== 'insight'
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

    let project = null;
    if (assessment.projectId) {
      const projectDoc = await Project.findOne({ _id: assessment.projectId, userId: req.auth.uid });
      project = projectDoc ? projectDoc.public() : null;
    }
    res.json({ ok: true, assessment, project });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/assessments/:id/premium', requireAuth, async (req, res) => {
  try {
    const assessment = await Assessment.findOne({ _id: req.params.id, userId: req.auth.uid });
    if (!assessment) return res.status(404).json({ error: 'Not found' });

    const {
      strategicDrivers = [],
      organization = {},
      companyProfile = {},
      capabilityFocus = [],
      techLandscape = {},
      vendorStrategy = {},
      operatingModel = {},
      personas = [],
      answers = {},
      premiumAnswers = {},
      architectureSignals = {},
      nextAssessmentType,
      industry: industryInput,
      companySize: companySizeInput,
      region: regionInput
    } = req.body || {};

    const targetType = nextAssessmentType || assessment.assessmentType;
    const capability = getCapability(targetType);
    assessment.assessmentType = capability.id;

    let organizationIntel = assessment.organization?.intel || {};
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
    if (industryInput) assessment.industry = industryInput;
    if (companySizeInput) assessment.companySize = companySizeInput;
    if (regionInput) assessment.region = regionInput;
    assessment.strategicDrivers = strategicDrivers.length ? strategicDrivers : assessment.strategicDrivers;
    const orgName = organization?.name || '';
    assessment.organization = {
      name: orgName || project?.companyProfile?.legalName || '',
      extract: orgName
        ? (organizationIntel.summary || organization?.extract || assessment.organization?.extract || project?.companyProfile?.summary || '')
        : (project?.companyProfile?.summary || assessment.organization?.extract || ''),
      intel: orgName ? organizationIntel : (assessment.organization?.intel || {})
    };
    const profileIntel = organizationIntel?.profile || {};
    const normaliseList = (value) => {
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
      ...companyProfile
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
    assessment.capabilityFocus = capabilityFocus.length
      ? capabilityFocus
      : (assessment.capabilityFocus?.length ? assessment.capabilityFocus : (project?.capabilityFocus?.length ? project.capabilityFocus : capability.domains));
    assessment.techLandscape = { ...(project?.techLandscape || {}), ...(assessment.techLandscape || {}), ...techLandscape };
    assessment.vendorStrategy = { ...(assessment.vendorStrategy || {}), ...vendorStrategy };
    assessment.operatingModel = {
      ...(project?.operatingModel || {}),
      ...(assessment.operatingModel || {}),
      ...operatingModel,
      discoveryObjectives: operatingModel.discoveryObjectives || mergedCompanyProfile.discoveryObjectives
    };
    assessment.personas = personas.length
      ? personas
      : (assessment.personas?.length ? assessment.personas : (project?.personas?.length ? project.personas : capability.personas));
    assessment.answers = { ...(assessment.answers || {}), ...answers };
    assessment.premiumAnswers = { ...(assessment.premiumAnswers || {}), ...premiumAnswers };
    const newArchitectureSignals = Object.fromEntries(
      Object.entries(architectureSignals || {}).map(([key, value]) => [key, String(value || '').slice(0, 1000)])
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

    if (project) {
      assessment.projectSnapshot = project.public();
    }

    await assessment.save();

    const reportData = await computeReport({ assessment });
    const report = await Report.findOneAndUpdate(
      { assessmentId: assessment._id, userId: req.auth.uid },
      { ...reportData, paid: true, assessmentId: assessment._id, userId: req.auth.uid, projectId: assessment.projectId },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({ ok: true, assessmentId: assessment._id, reportId: report._id, stage: report.stage });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Fetch report (partial view if not paid)
app.get('/api/reports/:id', requireAuth, async (req, res) => {
  try {
    const rep = await Report.findOne({ _id: req.params.id, userId: req.auth.uid });
    if (!rep) return res.status(404).json({ error: 'Not found' });
    const partial = {
      _id: rep._id,
      createdAt: rep.createdAt,
      vertical: rep.vertical,
      assessmentType: rep.assessmentType,
      stage: rep.stage,
      assessmentId: rep.assessmentId,
      summary: rep.summary,
      headlineScore: rep.headlineScore,
      pillarScores: rep.pillarScores,
      benchmarks: { medians: rep.benchmarks?.medians },
      recommendations: rep.recommendations.slice(0, 3),
      competitorSummary: rep.competitorSummary ? {
        percentile: rep.competitorSummary.percentile,
        narrative: rep.competitorSummary.narrative,
        median: rep.competitorSummary.median
      } : undefined,
      pillarInsights: Object.fromEntries(Object.entries(rep.pillarInsights || {}).slice(0, 1)),
      investmentOutlook: {
        savingsNarrative: rep.investmentOutlook?.savingsNarrative,
        pillarAllocations: Object.fromEntries(Object.entries(rep.investmentOutlook?.pillarAllocations || {}).slice(0, 1))
      },
      roadmap: Object.fromEntries(Object.entries(rep.roadmap || {}).slice(0, 1)),
      technologyRadar: (rep.technologyRadar || []).slice(0, 1),
      personaBriefings: (rep.personaBriefings || []).slice(0, 1),
      riskRegister: (rep.riskRegister || []).slice(0, 1),
      revenueOpportunities: (rep.revenueOpportunities || []).slice(0, 1),
      operationalPlan: Object.fromEntries(Object.entries(rep.operationalPlan || {}).slice(0, 1)),
      aiNarrative: rep.aiNarrative && rep.aiNarrative.executiveSummary ? { executiveSummary: rep.aiNarrative.executiveSummary } : {},
      architectureSignals: rep.architectureSignals || {},
      architectureBlueprint: {},
      roiMap: [],
      renewalCalendar: [],
      personaIntelligence: {},
      paid: rep.paid,
      partial: !rep.paid
    };
    res.json({ ok: true, report: rep.paid ? rep : partial });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/reports/:id/export', requireAuth, async (req, res) => {
  try {
    const rep = await Report.findOne({ _id: req.params.id, userId: req.auth.uid });
    if (!rep) return res.status(404).json({ error: 'Not found' });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Value Path');
    sheet.columns = [
      { header: 'Section', key: 'section', width: 28 },
      { header: 'Details', key: 'details', width: 90 }
    ];

    sheet.addRow({ section: 'Organisation', details: rep.structuredSections?.overview?.organisation || 'N/A' });
    sheet.addRow({ section: 'Summary', details: rep.summary || '' });
    sheet.addRow({ section: 'Strategic Drivers', details: (rep.structuredSections?.overview?.strategicDrivers || []).join('; ') });
    sheet.addRow({ section: 'Capability Focus', details: (rep.structuredSections?.overview?.capabilityFocus || []).join('; ') });
    sheet.addRow({ section: 'Headline Score', details: `${rep.headlineScore} (Percentile ${rep.competitorSummary?.percentile || '--'})` });

    sheet.addRow({ section: '---', details: 'Technology' });
    (rep.structuredSections?.technology?.toolingSnapshot || []).forEach(item => {
      sheet.addRow({ section: `Tech · ${item.area}`, details: item.tools.join(', ') });
    });
    (rep.structuredSections?.technology?.vendorSignals || []).forEach(item => {
      sheet.addRow({ section: `Vendor · ${item.theme}`, details: `${(item.vendors || []).join(', ')} — ${item.note || ''}` });
    });

    sheet.addRow({ section: '---', details: 'Data & Analytics' });
    (rep.structuredSections?.data?.pipelines || []).forEach(entry => {
      sheet.addRow({ section: 'Pipeline', details: entry });
    });
    (rep.structuredSections?.data?.insightExpectations || []).forEach(entry => {
      sheet.addRow({ section: 'Insights', details: entry });
    });

    sheet.addRow({ section: '---', details: 'People & Process' });
    (rep.structuredSections?.people?.organisationStructure || []).forEach(entry => {
      sheet.addRow({ section: 'Org Structure', details: entry });
    });
    sheet.addRow({ section: 'Talent Focus', details: rep.structuredSections?.people?.talentFocus || '' });
    sheet.addRow({ section: 'Change Management', details: rep.structuredSections?.people?.changeManagement || '' });
    sheet.addRow({ section: 'Governance', details: rep.structuredSections?.process?.governanceCadence || '' });
    sheet.addRow({ section: 'Procurement', details: rep.structuredSections?.process?.procurement || '' });
    sheet.addRow({ section: 'Reporting Chains', details: rep.structuredSections?.process?.reportingChains || '' });
    sheet.addRow({ section: 'MTTI Strategy', details: rep.structuredSections?.process?.meanTimeToInnocence || '' });

    sheet.addRow({ section: '---', details: 'Value Path Phases' });
    (rep.valuePath || []).forEach(phase => {
      sheet.addRow({
        section: phase.phase,
        details: `Duration: ${phase.duration || 'n/a'} | Focus: ${phase.focusPillar} | Target: ${phase.targetScore} | Coverage: ${phase.coverageFocus}`
      });
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${(rep.structuredSections?.overview?.organisation || 'agama-plan')}-${timestamp}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to export report' });
  }
});

// List latest reports for dashboard
app.get('/api/reports', requireAuth, async (req, res) => {
  try {
    const reports = await Report.find({ userId: req.auth.uid })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('_id createdAt headlineScore paid vertical');
    res.json({ ok: true, reports });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Mock payment to unlock
app.post('/api/payments/mock/checkout', requireAuth, async (req, res) => {
  try {
    const { reportId } = req.body || {};
    const rep = await Report.findOne({ _id: reportId, userId: req.auth.uid });
    if (!rep) return res.status(404).json({ error: 'Report not found' });
    // create payment record
    const pay = await Payment.create({
      userId: req.auth.uid,
      reportId,
      amount: 49900,
      currency: 'GBP',
      status: 'paid'
    });
    rep.paid = true;
    await rep.save();
    res.json({ ok: true, paymentId: pay._id, reportId: rep._id, assessmentId: rep.assessmentId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---- Static frontend ----
const PUBLIC_DIR = path.join(__dirname, 'public');
app.use(express.static(PUBLIC_DIR));

// Fallback to index.html for basic navigation
app.get('*', (req, res) => {
  const p = path.join(PUBLIC_DIR, 'index.html');
  res.sendFile(p);
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log('🚀 Agama Technologies backend running on port', port);
});
