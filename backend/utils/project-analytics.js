const mongoose = require('mongoose');
const Project = require('../models/Project');
const MaturityTimepoint = require('../models/MaturityTimepoint');
const BusinessMetric = require('../models/BusinessMetric');
const Initiative = require('../models/Initiative');

const pendingRecomputes = new Set();

function normaliseNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? Number(num.toFixed(2)) : null;
}

async function recordMaturityTimepoint({ projectId, assessmentId, domain, report }) {
  if (!projectId || !assessmentId || !report) return null;
  const overall = normaliseNumber(report.headlineScore) ?? 0;
  const pillars = {};
  if (report.pillarScores && typeof report.pillarScores === 'object') {
    for (const [pillar, value] of Object.entries(report.pillarScores)) {
      const num = normaliseNumber(value);
      if (num !== null) pillars[pillar] = num;
    }
  }
  const payload = {
    projectId,
    assessmentId,
    domain: domain || report.assessmentType || 'overall',
    scores: { overall, pillars },
    computedAt: new Date()
  };
  return MaturityTimepoint.create(payload);
}

async function recomputeProjectAnalytics(projectId) {
  if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) return null;
  const points = await MaturityTimepoint.find({ projectId })
    .sort({ computedAt: -1, _id: -1 })
    .limit(5)
    .lean();

  const sortedPoints = points.slice().reverse();
  const latest = sortedPoints[sortedPoints.length - 1];
  const previous = sortedPoints.length > 1 ? sortedPoints[sortedPoints.length - 2] : null;

  const allPillars = new Set();
  sortedPoints.forEach(point => {
    Object.keys(point?.scores?.pillars || {}).forEach(pillar => allPillars.add(pillar));
  });

  const history = {
    overall: [],
    pillars: {}
  };

  const ensureHistoryArray = (pillar) => {
    if (!history.pillars[pillar]) history.pillars[pillar] = [];
    return history.pillars[pillar];
  };

  sortedPoints.forEach(point => {
    const computedAt = point.computedAt;
    const overall = normaliseNumber(point?.scores?.overall);
    if (overall !== null) {
      history.overall.push({ computedAt, value: overall });
    }
    Object.entries(point?.scores?.pillars || {}).forEach(([pillar, value]) => {
      if (!allPillars.has(pillar)) return;
      const num = normaliseNumber(value);
      if (num === null) return;
      ensureHistoryArray(pillar).push({ computedAt, value: num });
    });
    allPillars.forEach(pillar => {
      if ((point?.scores?.pillars || {}).hasOwnProperty(pillar)) return;
      ensureHistoryArray(pillar).push({ computedAt, value: null });
    });
  });

  const latestPillars = {};
  const pillarDelta = {};
  allPillars.forEach(pillar => {
    const latestValue = normaliseNumber(latest?.scores?.pillars?.[pillar]);
    if (latestValue !== null) latestPillars[pillar] = latestValue;
    const previousValue = normaliseNumber(previous?.scores?.pillars?.[pillar]) ?? latestValue;
    const delta =
      latestValue !== null && previousValue !== null ? Number((latestValue - previousValue).toFixed(2)) : 0;
    pillarDelta[pillar] = delta;
  });

  const latestOverall = normaliseNumber(latest?.scores?.overall) ?? 0;
  const previousOverall = normaliseNumber(previous?.scores?.overall) ?? latestOverall;
  const overallDelta = Number((latestOverall - previousOverall).toFixed(2));

  const maturity = {
    overall: latestOverall,
    pillars: latestPillars,
    delta: { overall: overallDelta, pillars: pillarDelta },
    history,
    lastUpdated: latest?.computedAt || null
  };

  await Project.updateOne(
    { _id: projectId },
    {
      $set: {
        'analytics.maturity': maturity,
        'analytics.readinessScore': maturity.overall
      }
    }
  );

  return maturity;
}

function queueProjectAnalyticsRecompute(projectId) {
  const key = String(projectId);
  if (pendingRecomputes.has(key)) return;
  pendingRecomputes.add(key);
  setImmediate(async () => {
    try {
      await recomputeProjectAnalytics(projectId);
    } catch (err) {
      console.error('Failed to recompute project analytics', err);
    } finally {
      pendingRecomputes.delete(key);
    }
  });
}

async function getBusinessMetrics(projectId) {
  return BusinessMetric.find({ projectId }).sort({ year: 1 }).lean();
}

function computeYoY(series = []) {
  if (series.length < 2) return null;
  const prev = series[series.length - 2];
  const curr = series[series.length - 1];
  if (!prev || !curr || prev.value === null || curr.value === null || prev.value === 0) return null;
  const delta = ((curr.value - prev.value) / Math.abs(prev.value)) * 100;
  return Number(delta.toFixed(2));
}

async function buildChangeAttribution(projectId, points) {
  if (!points || points.length < 2) return [];
  const current = points[points.length - 1];
  const previous = points[points.length - 2];
  const windowStart = previous.computedAt;
  const windowEnd = current.computedAt;

  const initiatives = await Initiative.find({
    projectId,
    endDate: { $gt: windowStart, $lte: windowEnd }
  })
    .sort({ endDate: 1 })
    .lean();

  const changedPillars = new Set();
  Object.entries(current?.scores?.pillars || {}).forEach(([pillar, value]) => {
    const prevValue = normaliseNumber(previous?.scores?.pillars?.[pillar]);
    const currValue = normaliseNumber(value);
    if (prevValue === null || currValue === null) return;
    if (Number(currValue.toFixed(2)) !== Number(prevValue.toFixed(2))) {
      changedPillars.add(pillar);
    }
  });

  const results = [];
  changedPillars.forEach(pillar => {
    const prevValue = normaliseNumber(previous?.scores?.pillars?.[pillar]) ?? 0;
    const currValue = normaliseNumber(current?.scores?.pillars?.[pillar]) ?? prevValue;
    const delta = Number((currValue - prevValue).toFixed(2));
    if (delta === 0) return;
    const direction = delta >= 0 ? 1 : -1;
    const matches = initiatives
      .map(initiative => {
        const impacted = (initiative.impactedPillars || []).filter(p => p.pillar === pillar);
        if (!impacted.length) return null;
        const totalImpact = impacted.reduce((sum, entry) => sum + Number(entry.expectedImpact || 0), 0);
        if (totalImpact === 0 || Math.sign(totalImpact) !== direction) return null;
        return {
          initiative,
          weight: Math.abs(totalImpact)
        };
      })
      .filter(Boolean);

    if (!matches.length) {
      results.push({ pillar, delta, initiatives: [] });
      return;
    }

    const sorted = matches.sort((a, b) => b.weight - a.weight).slice(0, 3);
    const totalWeight = sorted.reduce((sum, entry) => sum + entry.weight, 0) || 1;
    const mapped = sorted.map(entry => ({
      id: entry.initiative._id,
      title: entry.initiative.title,
      expectedImpact: Number(entry.initiative.impactedPillars.find(p => p.pillar === pillar)?.expectedImpact || 0),
      share: Number(((entry.weight / totalWeight) * Math.abs(delta)).toFixed(2)),
      direction: direction,
      startDate: entry.initiative.startDate,
      endDate: entry.initiative.endDate
    }));

    results.push({ pillar, delta, initiatives: mapped });
  });

  return results;
}

async function getProjectAnalyticsSummary(projectId) {
  const [project, timepoints, metrics] = await Promise.all([
    Project.findById(projectId, 'analytics').lean(),
    MaturityTimepoint.find({ projectId }).sort({ computedAt: 1 }).lean(),
    getBusinessMetrics(projectId)
  ]);

  const maturity = project?.analytics?.maturity || {
    overall: 0,
    pillars: {},
    delta: { overall: 0, pillars: {} },
    history: { overall: [], pillars: {} },
    lastUpdated: null
  };

  const sparklines = { overall: [], pillars: {} };
  timepoints.forEach(point => {
    sparklines.overall.push({ computedAt: point.computedAt, value: normaliseNumber(point?.scores?.overall) });
    Object.entries(point?.scores?.pillars || {}).forEach(([pillar, value]) => {
      if (!sparklines.pillars[pillar]) sparklines.pillars[pillar] = [];
      sparklines.pillars[pillar].push({ computedAt: point.computedAt, value: normaliseNumber(value) });
    });
  });

  const business = {
    arr: metrics
      .filter(metric => metric.arrUSD !== null && metric.arrUSD !== undefined)
      .map(metric => ({ year: metric.year, value: Number(metric.arrUSD) })),
    headcount: metrics
      .filter(metric => metric.headcount !== null && metric.headcount !== undefined)
      .map(metric => ({ year: metric.year, value: Number(metric.headcount) }))
  };

  const changeAttribution = await buildChangeAttribution(projectId, timepoints);

  return { maturity, sparklines, business, changeAttribution };
}

async function getMaturityTimeseries(projectId, pillar = 'overall') {
  const points = await MaturityTimepoint.find({ projectId }).sort({ computedAt: 1 }).lean();
  return points
    .map(point => {
      if (pillar === 'overall') {
        return { computedAt: point.computedAt, value: normaliseNumber(point?.scores?.overall), assessmentId: point.assessmentId };
      }
      const value = normaliseNumber(point?.scores?.pillars?.[pillar]);
      if (value === null) return null;
      return { computedAt: point.computedAt, value, assessmentId: point.assessmentId };
    })
    .filter(Boolean);
}

module.exports = {
  recordMaturityTimepoint,
  recomputeProjectAnalytics,
  queueProjectAnalyticsRecompute,
  getProjectAnalyticsSummary,
  getMaturityTimeseries,
  getBusinessMetrics,
  computeYoY
};
