const Entitlement = require('../models/Entitlement');

const TIER_PRIORITY = { free: 0, strategic: 1, command: 2 };

function tierRank(tier = 'free') {
  return TIER_PRIORITY[tier] ?? 0;
}

function tierAllowsStrategic(tier = 'free') {
  return tierRank(tier) >= tierRank('strategic');
}

function tierAllowsCommand(tier = 'free') {
  return tierRank(tier) >= tierRank('command');
}

async function getActiveEntitlement(userId) {
  if (!userId) return null;
  const now = new Date();
  const entitlements = await Entitlement.find({
    userId,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }]
  })
    .sort({ expiresAt: -1, createdAt: -1 })
    .lean();
  if (!entitlements.length) return null;
  return entitlements.reduce((best, current) => {
    if (!best) return current;
    return tierRank(current.tier) > tierRank(best.tier) ? current : best;
  }, null);
}

async function resolveTierForUser(userId, fallbackPaid = false) {
  const entitlement = await getActiveEntitlement(userId);
  if (entitlement) {
    return { tier: entitlement.tier, record: entitlement };
  }
  if (fallbackPaid) {
    return { tier: 'strategic', record: null };
  }
  return { tier: 'free', record: null };
}

async function resolveTierForReport(report) {
  if (!report) return { tier: 'free', record: null };
  const { tier, record } = await resolveTierForUser(report.userId, Boolean(report.paid));
  return { tier, record };
}

async function grantEntitlement({ userId, tier, expiresAt }) {
  if (!userId || !tier) {
    throw new Error('userId and tier are required to grant entitlement');
  }
  const update = {
    userId,
    tier,
    expiresAt: expiresAt || null
  };
  return Entitlement.findOneAndUpdate({ userId, tier }, update, {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true
  });
}

async function revokeEntitlements(userId) {
  if (!userId) return;
  await Entitlement.deleteMany({ userId });
}

function sanitizeReportForTier(reportDoc, tier = 'free') {
  if (!reportDoc) return null;
  const report = typeof reportDoc.toObject === 'function' ? reportDoc.toObject() : { ...reportDoc };
  const access = {
    tier,
    hasPremium: tierAllowsStrategic(tier),
    command: tierAllowsCommand(tier)
  };

  if (tierAllowsStrategic(tier)) {
    return { ...report, access };
  }

  const preview = {
    _id: report._id,
    projectId: report.projectId,
    assessmentId: report.assessmentId,
    createdAt: report.createdAt,
    vertical: report.vertical,
    assessmentType: report.assessmentType,
    stage: report.stage,
    summary: report.summary,
    headlineScore: report.headlineScore,
    pillarScores: report.pillarScores,
    recommendations: Array.isArray(report.recommendations)
      ? report.recommendations.slice(0, 3)
      : [],
    insightHighlights: report.insightHighlights || [],
    personaBriefings: Array.isArray(report.personaBriefings)
      ? report.personaBriefings.slice(0, 1)
      : [],
    previewSections: {
      competitorSummary: report.competitorSummary ? { narrative: report.competitorSummary.narrative } : null,
      technologyRadar: Array.isArray(report.technologyRadar) ? report.technologyRadar.slice(0, 1) : [],
      roadmap: report.roadmap ? Object.fromEntries(Object.entries(report.roadmap).slice(0, 1)) : {},
      pillarInsights: report.pillarInsights
        ? Object.fromEntries(Object.entries(report.pillarInsights).slice(0, 1))
        : {},
      investmentOutlook: report.investmentOutlook
        ? {
            savingsNarrative: report.investmentOutlook.savingsNarrative,
            pillarAllocations: report.investmentOutlook.pillarAllocations
              ? Object.fromEntries(Object.entries(report.investmentOutlook.pillarAllocations).slice(0, 1))
              : {}
          }
        : null
    },
    access
  };

  return preview;
}

function attachAccessToReports(reports = [], tier = 'free') {
  const access = {
    tier,
    hasPremium: tierAllowsStrategic(tier),
    command: tierAllowsCommand(tier)
  };
  return reports.map(report => ({
    ...report,
    paid: access.hasPremium,
    access
  }));
}

module.exports = {
  getActiveEntitlement,
  resolveTierForUser,
  resolveTierForReport,
  sanitizeReportForTier,
  attachAccessToReports,
  grantEntitlement,
  revokeEntitlements,
  tierRank,
  tierAllowsStrategic,
  tierAllowsCommand
};
