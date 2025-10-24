const fs = require('fs');
const path = require('path');

function clamp(v, min = 0, max = 100) {
  return Math.max(min, Math.min(max, v));
}

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

const PLAYBOOKS = {
  Observability: {
    foundational: [
      'Establish golden signals with service-level objectives across critical journeys',
      'Instrument tracing coverage for top customer workflows'
    ],
    scaling: [
      'Automate alert routing with AIOps correlation and intelligent suppression',
      'Expand runbook automation and embed retrospectives into delivery cadence'
    ],
    optimised: [
      'Optimise telemetry costs with adaptive sampling and usage governance',
      'Extend observability data into business KPIs and customer health scoring'
    ]
  },
  Security: {
    foundational: [
      'Implement identity hardening (MFA/SSO) and tiered access reviews',
      'Stand up automated vulnerability scanning with remediation SLAs'
    ],
    scaling: [
      'Integrate detection engineering with observability data for unified SOC insights',
      'Automate incident response playbooks with tabletop validation'
    ],
    optimised: [
      'Adopt continuous compliance monitoring with policy as code',
      'Deploy predictive threat modelling with ML-based anomaly detection'
    ]
  },
  AIOps: {
    foundational: [
      'Aggregate events into a unified lake with topology context',
      'Deploy anomaly detection to critical services and platforms'
    ],
    scaling: [
      'Automate remediation workflows for recurring incidents',
      'Enrich events with business impact scoring to prioritise response'
    ],
    optimised: [
      'Operationalise predictive maintenance models tied to FinOps signals',
      'Embed AI copilots into incident response and runbook authoring'
    ]
  },
  'Business Analytics': {
    foundational: [
      'Define governed data contracts and ingestion quality guardrails',
      'Deliver executive dashboards for core KPIs and OKRs'
    ],
    scaling: [
      'Roll out experimentation and causal analytics across product squads',
      'Automate metric anomaly detection with ML-enabled observability'
    ],
    optimised: [
      'Implement decision intelligence loops with AI-assisted forecasting',
      'Operationalise privacy-preserving ML for customer insight and growth'
    ]
  }
};

const TECH_RECS = {
  Observability: [
    {
      horizon: 'Now',
      category: 'Telemetry Fabric',
      vendors: ['Grafana Cloud', 'Chronosphere'],
      rationale: 'Accelerate SLO instrumentation and achieve high-cardinality cost control with governance.'
    },
    {
      horizon: 'Next',
      category: 'Incident Automation',
      vendors: ['PagerDuty AIOps', 'FireHydrant'],
      rationale: 'Automate enrichment and response workflows to compress MTTR.'
    }
  ],
  Security: [
    {
      horizon: 'Now',
      category: 'Zero Trust Access',
      vendors: ['Okta Workforce Identity', 'Teleport'],
      rationale: 'Centralise identity assurance with least-privilege enforcement and session recording.'
    },
    {
      horizon: 'Next',
      category: 'Detection & Response',
      vendors: ['CrowdStrike Falcon', 'Snyk'],
      rationale: 'Combine runtime protection with developer-first security automation.'
    }
  ],
  AIOps: [
    {
      horizon: 'Next',
      category: 'Event Intelligence',
      vendors: ['Moogsoft', 'BigPanda'],
      rationale: 'Correlate telemetry streams and surface probable root cause in minutes.'
    },
    {
      horizon: 'Future',
      category: 'Predictive Operations',
      vendors: ['IBM Turbonomic', 'Azure Machine Learning'],
      rationale: 'Drive capacity forecasting and cost optimisation with policy-driven automation.'
    }
  ],
  'Business Analytics': [
    {
      horizon: 'Now',
      category: 'Modern Data Stack',
      vendors: ['Snowflake', 'dbt', 'Fivetran'],
      rationale: 'Enable governed, composable analytics with rapid iteration.'
    },
    {
      horizon: 'Future',
      category: 'Decision Intelligence',
      vendors: ['ThoughtSpot Sage', 'Looker Blocks'],
      rationale: 'Empower teams with AI-assisted insights and scenario modelling.'
    }
  ]
};

function deriveMaturity(score) {
  if (score < 50) return 'Foundational';
  if (score < 70) return 'Scaling';
  return 'Optimised';
}

function percentileFromMedian(score, median) {
  const diff = score - (median ?? 60);
  return clamp(Math.round(50 + diff * 1.4), 1, 99);
}

function narrativeForOverall(percentile, median, vertical) {
  if (percentile >= 85) {
    return `You outperform ${vertical} leaders, sitting in the top ${percentile}th percentile. Maintain innovation pace while focusing on efficiency.`;
  }
  if (percentile >= 60) {
    return `You are competitive with ${vertical} peers and can leapfrog leaders with targeted automation in the next two quarters.`;
  }
  return `There is significant upside versus the ${vertical} median (score ${median}). Prioritise foundational execution to close capability gaps.`;
}

async function computeReport({ assessment }) {
  const answers = assessment.answers || {};
  const pillars = Object.keys(answers);
  const pillarScores = {};

  for (const pillar of pillars) {
    const values = Object.values(answers[pillar] || {}).map(Number).filter(v => !isNaN(v));
    const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    pillarScores[pillar] = Math.round(clamp((avg / 5) * 100));
  }

  const headlineScore = Math.round(
    clamp(
      Object.values(pillarScores).reduce((a, b) => a + b, 0) /
        (Object.keys(pillarScores).length || 1)
    )
  );

  const verticalKey = assessment.vertical || 'generic';
  const verticalLabel = verticalKey === 'generic' ? 'cross-industry peers' : verticalKey.toUpperCase();
  const bm = loadBenchmarks(verticalKey);
  const benchmarks = {
    vertical: verticalKey,
    companySize: assessment.companySize,
    medians: bm.medians,
    percentiles: bm.percentiles,
    spend: bm.spend,
    leaders: bm.leaders
  };

  const recommendations = [];
  for (const [pillar, score] of Object.entries(pillarScores)) {
    const maturity = deriveMaturity(score);
    const book = PLAYBOOKS[pillar]?.[maturity.toLowerCase()] || [];
    const primary = book[0] || `${pillar}: Focus initiatives on measurable outcomes.`;
    recommendations.push(`${pillar}: ${primary}`);
  }

  const overallMedian = bm.medians?.overall ?? 60;
  const overallPercentile = percentileFromMedian(headlineScore, overallMedian);
  const competitorSummary = {
    percentile: overallPercentile,
    median: overallMedian,
    leaders: bm.leaders || [],
    narrative: narrativeForOverall(overallPercentile, overallMedian, verticalLabel)
  };

  const pillarInsights = {};
  for (const [pillar, score] of Object.entries(pillarScores)) {
    const median = bm.medians?.pillars?.[pillar] ?? overallMedian;
    const percentile = percentileFromMedian(score, median);
    const maturity = deriveMaturity(score);
    const book = PLAYBOOKS[pillar];
    pillarInsights[pillar] = {
      score,
      median,
      percentile,
      maturity,
      commentary:
        score >= median
          ? `Ahead of peers by ${Math.abs(score - median)} pts. Continue scaling automation to solidify leadership.`
          : `Lagging peers by ${Math.abs(score - median)} pts. Prioritise foundational capabilities and ownership to catch up.`,
      quickWins: book ? book[maturity.toLowerCase()].slice(0, 2) : []
    };
  }

  const sortedPillars = Object.entries(pillarScores).sort((a, b) => a[1] - b[1]).map(([pillar]) => pillar);
  const focusPillars = sortedPillars.slice(0, 2);
  const roadmap = {
    '0-30 days': [
      'Stand up an executive-backed modernisation squad with clear funding and KPIs.',
      ...focusPillars.map(p => `Run discovery sprints for ${p.toLowerCase()} to baseline telemetry, risks, and quick automation wins.`)
    ],
    '30-90 days': [
      'Deploy target-state architecture blueprints with measurable adoption metrics.',
      ...focusPillars.map(p => `Implement top-two initiatives for ${p.toLowerCase()} including tooling enablement and training.`)
    ],
    'Quarter 2+': [
      'Scale cross-functional operating rhythms with OKRs and automation guardrails.',
      ...focusPillars.map(p => `Optimise ${p.toLowerCase()} investments with continuous improvement and ROI tracking.`)
    ]
  };

  const pillarAllocations = {};
  for (const [pillar, score] of Object.entries(pillarScores)) {
    const spend = bm.spend?.[pillar] || { median: 0.07, leaders: 0.11 };
    const maturity = deriveMaturity(score).toLowerCase();
    const range = `${Math.round(spend.median * 100)}%-${Math.round(spend.leaders * 100)}% of platform budget`;
    const focus = maturity === 'foundational' ? 'foundational controls & automation' : maturity === 'scaling' ? 'automation and integration' : 'value optimisation and innovation';
    pillarAllocations[pillar] = {
      recommendation: `Invest ${range} towards ${focus}.`
    };
  }

  const savingsPotential = clamp(95 - Math.round(headlineScore / 1.2), 30, 95);
  const investmentOutlook = {
    savingsNarrative: `Target up to ${savingsPotential}% reduction in run costs by shifting toil to automation and optimising compute/observability spend.`,
    pillarAllocations
  };

  const technologyRadar = [];
  for (const [pillar, recs] of Object.entries(TECH_RECS)) {
    recs.forEach(rec => {
      technologyRadar.push({
        pillar,
        horizon: rec.horizon,
        category: rec.category,
        vendors: rec.vendors,
        rationale: rec.rationale
      });
    });
  }

  const summary = `Your overall maturity score is ${headlineScore}. Compared to ${verticalLabel}, you are ${headlineScore >= overallMedian ? 'ahead of' : 'behind'} the median of ${overallMedian}.`;
  const strategicNarrative = `Agama Technologies experts analysed your ${verticalLabel} operating model. Drawing on over 100 years of delivery experience, we identified where AI, security, observability, and analytics can jointly drive modernisation with up to 95% cost optimisation.`;

  return {
    vertical: verticalKey,
    headlineScore,
    pillarScores,
    benchmarks,
    recommendations,
    summary,
    strategicNarrative,
    competitorSummary,
    pillarInsights,
    roadmap,
    investmentOutlook,
    technologyRadar
  };
}

module.exports = { computeReport };
