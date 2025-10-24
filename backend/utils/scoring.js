const fs = require('fs');
const path = require('path');

function clamp(v, min=0, max=100){ return Math.max(min, Math.min(max, v)); }

function loadBenchmarks(vertical) {
  const base = path.join(__dirname, '..', 'data', 'benchmarks');
  const tryPath = path.join(base, `${vertical}.json`);
  const generic = path.join(base, 'generic.json');
  try {
    return JSON.parse(fs.readFileSync(tryPath, 'utf-8'));
  } catch {
    return JSON.parse(fs.readFileSync(generic, 'utf-8'));
  }
}

// Compute simple weighted scores (0-100) per pillar and headline
async function computeReport({ assessment }) {
  const answers = assessment.answers || {};
  const pillars = Object.keys(answers);
  const pillarScores = {};

  for (const p of pillars) {
    const q = answers[p] || {};
    const values = Object.values(q).map(Number).filter(v => !isNaN(v));
    const avg = values.length ? (values.reduce((a,b)=>a+b,0)/values.length) : 0;
    // Map 0-5 scale to 0-100
    pillarScores[p] = Math.round(clamp((avg/5)*100));
  }
  const headlineScore = Math.round(clamp(
    Object.values(pillarScores).reduce((a,b)=>a+b,0) / (Object.keys(pillarScores).length || 1)
  ));

  const bm = loadBenchmarks(assessment.vertical || 'generic');
  const benchmarks = { vertical: assessment.vertical, companySize: assessment.companySize, medians: bm.medians };

  // Generate light recommendations
  const recommendations = [];
  for (const [pillar, score] of Object.entries(pillarScores)) {
    if (score < 50) recommendations.push(`${pillar}: Prioritise foundational capabilities and establish ownership with a 90-day plan.`);
    else if (score < 70) recommendations.push(`${pillar}: Focus on automation, playbooks, and tooling consolidation to reduce toil and MTTR.`);
    else recommendations.push(`${pillar}: Optimise cost-to-value and implement continuous improvement with SLOs and KPIs.`);
  }

  const summary = `Your overall maturity score is ${headlineScore}. Compared to ${assessment.vertical || 'peers'}, you are ${headlineScore >= (bm.medians?.overall||60) ? 'ahead of' : 'behind'} the median.`;

  return { headlineScore, pillarScores, benchmarks, recommendations, summary };
}

module.exports = { computeReport };
