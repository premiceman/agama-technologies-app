const fs = require('fs');
const path = require('path');
const { getCapability, PERSONA_BLUEPRINTS } = require('../data/catalog');
const {
  generateExecutiveNarrative,
  generateStrategicIntelligence,
  generateCommandBlueprint,
  generateArchitectureAssets
} = require('./openai');

function clamp(v, min = 0, max = 100) {
  return Math.max(min, Math.min(max, v));
}

function coerceList(value, { limit = 12 } = {}) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map(item => (typeof item === 'string' ? item.trim() : item))
      .filter(Boolean)
      .slice(0, limit);
  }
  return String(value)
    .split(/\n|;|\u2022|\r/g)
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function extractMaturityScore(entry) {
  if (entry === null || entry === undefined) return null;
  if (typeof entry === 'number') {
    const num = Number(entry);
    return Number.isFinite(num) ? num : null;
  }
  if (typeof entry === 'object') {
    if (entry === null) return null;
    if (typeof entry.maturity === 'number') {
      return Number.isFinite(entry.maturity) ? entry.maturity : null;
    }
    if (typeof entry.score === 'number') {
      return Number.isFinite(entry.score) ? entry.score : null;
    }
  }
  const num = Number(entry);
  return Number.isFinite(num) ? num : null;
}

function extractUrgency(entry) {
  if (entry && typeof entry === 'object' && typeof entry.urgency === 'number') {
    return clamp(entry.urgency, 1, 5);
  }
  return null;
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
      'Stand up golden signals and SLOs across customer-critical services',
      'Instrument distributed tracing for top revenue journeys'
    ],
    scaling: [
      'Operationalise adaptive alerting with automation and AI triage',
      'Extend incident post-mortems into product planning'
    ],
    optimised: [
      'Align observability KPIs directly to customer experience metrics',
      'Optimise telemetry spend with tiered retention and sampling'
    ]
  },
  Security: {
    foundational: [
      'Close identity gaps with MFA/SSO expansion and privileged access reviews',
      'Deploy continuous vulnerability discovery with remediation SLAs'
    ],
    scaling: [
      'Fuse detection engineering with threat intelligence and purple teaming',
      'Automate incident containment workflows integrated with SOC tooling'
    ],
    optimised: [
      'Adopt predictive threat hunting with advanced analytics and AI copilots',
      'Implement policy-as-code for continuous compliance readiness'
    ]
  },
  AIOps: {
    foundational: [
      'Unify event streams with topology context to reduce noise',
      'Deploy anomaly detection to high-value services and platforms'
    ],
    scaling: [
      'Automate enrichment and remediation for the top recurring incident types',
      'Use business impact scoring to prioritise operations backlog'
    ],
    optimised: [
      'Operationalise predictive maintenance models with closed-loop automation',
      'Embed copilots across incident response, runbooks, and change management'
    ]
  },
  'Business Analytics': {
    foundational: [
      'Define governed data contracts and executive-aligned KPIs',
      'Establish high-trust dashboards for core customer & revenue metrics'
    ],
    scaling: [
      'Embed experimentation & causal analytics across teams',
      'Automate data quality monitoring with anomaly detection'
    ],
    optimised: [
      'Deploy decision intelligence loops linking telemetry and financial outcomes',
      'Operationalise privacy-preserving AI for insight generation'
    ]
  },
  'Platform Engineering': {
    foundational: [
      'Launch an internal developer platform with paved-path templates',
      'Codify secure defaults for CI/CD and infrastructure provisioning'
    ],
    scaling: [
      'Introduce golden paths with policy-as-code and workload standards',
      'Instrument platform SLAs and developer experience metrics'
    ],
    optimised: [
      'Automate governance, compliance, and resilience testing across the platform',
      'Continuously evolve platform capabilities based on product feedback'
    ]
  },
  'People & Skills': {
    foundational: [
      'Create a capability heatmap and targeted enablement plan',
      'Define clear role charters aligned to observability/security/AI outcomes'
    ],
    scaling: [
      'Launch communities of practice and structured upskilling pathways',
      'Align incentives and OKRs to cross-functional collaboration'
    ],
    optimised: [
      'Institutionalise talent rotation, mentoring, and guilds driving innovation',
      'Embed workforce analytics to track proficiency and impact'
    ]
  },
  'Process & Governance': {
    foundational: [
      'Stand up integrated DevSecOps operating rhythms with shared dashboards',
      'Document decision rights and escalation paths for critical events'
    ],
    scaling: [
      'Automate evidence capture and controls testing within workflows',
      'Introduce executive scorecards linking risk, reliability, and value'
    ],
    optimised: [
      'Adopt continuous compliance with policy-as-code and regulatory mapping',
      'Run governance forums using predictive insights and scenario planning'
    ]
  },
  'Data & AI': {
    foundational: [
      'Define data contracts, lineage, and quality SLAs for mission-critical domains',
      'Implement responsible AI guardrails for model development'
    ],
    scaling: [
      'Automate anomaly detection and incident routing for data quality',
      'Operationalise AI models with monitoring and shadow deployments'
    ],
    optimised: [
      'Monetise data products with embedded analytics and AI services',
      'Continuously evaluate AI fairness, drift, and regulatory alignment'
    ]
  },
  'Operations & Automation': {
    foundational: [
      'Codify end-to-end incident playbooks and ownership matrices',
      'Prioritise automation for toil-heavy processes'
    ],
    scaling: [
      'Deploy workflow automation and low-code actions across operations',
      'Measure automation ROI and redeploy reclaimed capacity'
    ],
    optimised: [
      'Adopt predictive runbooks with AI copilots triggering remediation',
      'Integrate automation insights into quarterly business reviews'
    ]
  }
};

const TECH_RECS = {
  Observability: [
    {
      horizon: 'Now',
      category: 'Telemetry Fabric',
      vendors: ['Grafana Cloud', 'Chronosphere'],
      rationale: 'Accelerate SLO instrumentation and govern high-cardinality telemetry spend.'
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
      rationale: 'Centralise identity assurance with least-privilege enforcement and session intelligence.'
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
      rationale: 'Drive capacity forecasting and cost optimisation with AI-driven policy.'
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
  ],
  'Platform Engineering': [
    {
      horizon: 'Now',
      category: 'Internal Developer Platforms',
      vendors: ['Humanitec', 'Backstage'],
      rationale: 'Accelerate golden path adoption and reduce cognitive load on product teams.'
    },
    {
      horizon: 'Next',
      category: 'Secure SDLC Automation',
      vendors: ['GitHub Advanced Security', 'Snyk'],
      rationale: 'Bake security guardrails into pipelines and infrastructure automation.'
    }
  ],
  'People & Skills': [
    {
      horizon: 'Now',
      category: 'Skills Intelligence',
      vendors: ['Pluralsight Flow', 'Skillsoft'],
      rationale: 'Baseline capability gaps and launch targeted enablement programs.'
    },
    {
      horizon: 'Next',
      category: 'Knowledge Management',
      vendors: ['Notion', 'Confluence', 'Guru'],
      rationale: 'Codify playbooks and accelerate onboarding with searchable knowledge bases.'
    }
  ],
  'Process & Governance': [
    {
      horizon: 'Now',
      category: 'Policy Automation',
      vendors: ['Drata', 'Vanta'],
      rationale: 'Automate evidence collection for SOC2, ISO, and regulatory frameworks.'
    },
    {
      horizon: 'Future',
      category: 'Integrated Risk Management',
      vendors: ['ServiceNow GRC', 'OneTrust'],
      rationale: 'Unify risk, compliance, and control monitoring across portfolios.'
    }
  ],
  'Data & AI': [
    {
      horizon: 'Now',
      category: 'Data Quality & Observability',
      vendors: ['Monte Carlo', 'Bigeye'],
      rationale: 'Guarantee trusted data and AI inputs through automated monitoring.'
    },
    {
      horizon: 'Next',
      category: 'Responsible AI Platforms',
      vendors: ['Fiddler AI', 'Arthur AI'],
      rationale: 'Monitor fairness, drift, and compliance for production AI workloads.'
    }
  ],
  'Operations & Automation': [
    {
      horizon: 'Now',
      category: 'Runbook Automation',
      vendors: ['RunDeck', 'StackStorm'],
      rationale: 'Codify and orchestrate recurring operational workflows.'
    },
    {
      horizon: 'Future',
      category: 'Copilot Adoption',
      vendors: ['Microsoft Copilot Studio', 'Forethought Solve'],
      rationale: 'Embed AI assistants across operations to unlock human capacity.'
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

function mergeAnswers(...sources) {
  const merged = {};
  sources.forEach(source => {
    for (const [pillar, entries] of Object.entries(source || {})) {
      merged[pillar] = Object.assign({}, merged[pillar] || {}, entries || {});
    }
  });
  return merged;
}

function buildPersonaBriefings({ capability, assessment, pillarScores }) {
  const personas = assessment.personas?.length ? assessment.personas : PERSONA_BLUEPRINTS[assessment.assessmentType] || [];
  const focusPillars = Object.entries(pillarScores)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 2)
    .map(([pillar]) => pillar);
  const strengthPillars = Object.entries(pillarScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([pillar]) => pillar);
  const personaKpis = assessment.companyProfile?.personaKpis || {};

  return personas.map(persona => {
    const maturityLens = focusPillars.includes(capability.domains[0]) ? 'Stabilise foundations' : 'Accelerate differentiation';
    const lowerTitle = typeof persona.title === 'string' ? persona.title.toLowerCase() : undefined;
    const kpiSource = personaKpis[persona.id] || personaKpis[persona.title] || (lowerTitle ? personaKpis[lowerTitle] : []) || [];
    const metrics = coerceList(kpiSource, { limit: 4 });
    return {
      id: persona.id,
      title: persona.title,
      outcomes: persona.outcomes,
      focusPillars,
      strengthPillars,
      maturityLens,
      actions: [
        `Prioritise ${focusPillars.join(' & ')} initiatives to unlock ${persona.outcomes[0]}.`,
        `Leverage ${strengthPillars.join(' & ')} strengths to showcase quick wins to stakeholders.`
      ],
      metrics: metrics.length
        ? metrics
        : [
            'Leading indicator: MTTR / time-to-detect trend',
            'Lagging indicator: Customer trust / revenue at risk'
          ]
    };
  });
}

function buildRiskRegister({ pillarScores, benchmarks, assessment }) {
  const items = [];
  for (const [pillar, score] of Object.entries(pillarScores)) {
    const median = benchmarks.medians?.pillars?.[pillar] ?? benchmarks.medians?.overall ?? 60;
    if (score >= median) continue;
    const gap = median - score;
    const priority = gap > 20 ? '0-30 days' : gap > 10 ? '30-90 days' : 'Quarter 2+';
    items.push({
      pillar,
      gap,
      risk: `${pillar} capability deficit`,
      impact: gap > 20 ? 'Severe' : gap > 10 ? 'High' : 'Moderate',
      mitigation: `Allocate targeted investment to ${pillar.toLowerCase()} with executive sponsorship and automation focus.`,
      priority,
      owner: assessment.personas?.[0]?.title || 'Executive Sponsor'
    });
  }
  if (!items.length) {
    items.push({
      pillar: 'Cross-capability',
      gap: 0,
      risk: 'Sustainability of gains',
      impact: 'Moderate',
      mitigation: 'Embed continuous improvement cadences and FinOps guardrails to maintain leadership position.',
      priority: 'Quarter 2+',
      owner: assessment.personas?.[0]?.title || 'Transformation Office'
    });
  }
  return items;
}

function buildRevenueOpportunities({ pillarScores, assessment }) {
  const strategicDrivers = assessment.strategicDrivers || [];
  const strengths = Object.entries(pillarScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  return strengths.map(([pillar, score]) => ({
    pillar,
    score,
    narrative: `Leverage ${pillar.toLowerCase()} maturity (score ${score}) to advance '${strategicDrivers[0] || 'growth'}' outcomes through AI-enabled services and customer journey optimisation.`
  }));
}

function buildOperationalPlan({ focusPillars, capability, assessment }) {
  const focusKey = focusPillars[0] || capability.domains?.[0] || 'priority capability';
  const focusLabel = focusPillars.length ? focusPillars.join(' & ') : focusKey;
  return {
    '0-30 days': [
      `Mobilise a cross-functional ${capability.name} squad with executive sponsor ${assessment.personas?.[0]?.title || 'C-suite leader'}.`,
      `Baseline KPIs, risk, and telemetry for ${focusLabel}.`,
      'Define governance forums and reporting cadence tied to board priorities.'
    ],
    '30-90 days': [
      `Execute top automation plays for ${focusKey} leveraging preferred vendors and internal champions.`,
      'Expand enablement programs and update operating model playbooks.',
      'Integrate financial and customer impact tracking into executive dashboards.'
    ],
    'Quarter 2+': [
      'Scale data-driven decisioning with AI copilots across personas.',
      `Continuously optimise vendor portfolio aligned to ${capability.name} ROI.`,
      'Institutionalise continuous improvement, retrospectives, and innovation backlog.'
    ]
  };
}

function buildIndustryInsights({ assessment, benchmarks, technologyRadar }) {
  const industry = assessment.industry || assessment.vertical || 'Cross-industry';
  const maturitySignals = Object.entries(benchmarks.medians?.pillars || {})
    .map(([pillar, median]) => ({ pillar, median, target: median + 10 }))
    .slice(0, 5);

  const watchlist = [];
  if (assessment.assessmentType === 'security') {
    watchlist.push('Monitor identity provider CVEs (Okta, Entra ID) and align patch windows to SOX-critical systems.');
    watchlist.push('Track ransomware campaigns targeting ' + industry + ' supply chains with MITRE mapping.');
  }
  if (assessment.assessmentType === 'observability') {
    watchlist.push('Adopt OpenTelemetry collectors to de-risk vendor lock-in and enable multi-cloud portability.');
    watchlist.push('Benchmark outage communication cadences against industry leaders listed in benchmarks.leaders.');
  }
  if (assessment.assessmentType === 'analytics') {
    watchlist.push('Assess data residency and AI privacy implications for regulated segments.');
    watchlist.push('Ensure FinOps disciplines govern experimentation spend and AI workload scaling.');
  }
  if (assessment.assessmentType === 'aiops') {
    watchlist.push('Confirm topology sources cover edge / OT environments to prevent blind spots.');
    watchlist.push('Evaluate automation blast radius and rollback readiness before scaling runbook AI.');
  }

  const radarFocus = (technologyRadar || []).slice(0, 6).map(item => ({
    capability: item.pillar,
    category: item.category,
    vendors: item.vendors,
    rationale: item.rationale
  }));

  return {
    industry,
    maturitySignals,
    watchlist,
    radarFocus,
    leaderBenchmarks: benchmarks.leaders || []
  };
}

function buildVendorEngagements({ assessment, technologyRadar }) {
  const personaOwner = assessment.personas?.[0]?.title || 'Executive sponsor';
  return (technologyRadar || []).slice(0, 8).map(item => ({
    capability: item.pillar,
    category: item.category,
    vendors: item.vendors,
    pocScope: `Design a ${item.category.toLowerCase()} proof-of-concept that ${item.rationale.toLowerCase()}.`,
    successMeasures: [
      'Define automation, risk, and experience metrics with baselines before POC start.',
      'Document exit criteria and commercial guardrails aligned to strategic objectives.'
    ],
    negotiationQuestions: [
      `Ask ${item.vendors[0] || 'the vendor'} how pricing scales with telemetry volume and automation coverage.`,
      'Probe roadmap alignment to OpenTelemetry, zero trust, or AI co-pilots as relevant.',
      `Clarify professional services effort required for integration with ${personaOwner} teams.`
    ]
  }));
}

function buildDeliveryTimeline({ roadmap, initiativeTimeline = [] }) {
  const structured = Object.entries(roadmap || {}).map(([phase, items]) => ({
    phase,
    horizon: phase,
    initiatives: items
  }));

  initiativeTimeline.forEach(item => {
    structured.push({
      phase: item.title || 'Strategic initiative',
      horizon: item.timeline || 'Custom',
      initiatives: [
        `${item.owner ? `${item.owner}: ` : ''}${item.description || 'Key milestone'}`,
        item.outcome ? `Target outcome: ${item.outcome}` : undefined
      ].filter(Boolean)
    });
  });

  return structured;
}

function buildStructuredSections({
  assessment,
  capability,
  summary,
  competitorSummary,
  pillarInsights,
  personaBriefings,
  technologyRadar,
  industryInsights,
  riskRegister,
  revenueOpportunities,
  roadmap,
  pillarUrgency
}) {
  const organisation = assessment.organization?.name || assessment.companyProfile?.companyName || 'Your organisation';
  const strategicDrivers = assessment.strategicDrivers || [];
  const capabilityFocus = assessment.capabilityFocus || [];
  const personaHighlights = (personaBriefings || []).map(brief => ({
    title: brief.title,
    focus: brief.actions?.[0],
    metrics: brief.metrics || []
  }));

  const maturitySignals = Object.entries(pillarInsights || {}).map(([pillar, insight]) => ({
    pillar,
    score: insight.score,
    percentile: insight.percentile,
    maturity: insight.maturity,
    urgency: pillarUrgency[pillar] || null,
    commentary: insight.commentary,
    quickWins: insight.quickWins || []
  }));

  const techLandscape = Object.entries(assessment.techLandscape || {}).map(([key, value]) => ({
    area: key,
    tools: coerceList(value)
  })).filter(item => item.tools.length);

  const vendorSignals = (assessment.organization?.intel?.vendorSignals || []).map(signal => ({
    theme: signal.theme,
    vendors: signal.leadingVendors,
    note: signal.investmentNotes
  }));

  const architectureSignals = [];
  const intelSignals = assessment.organization?.intel?.profile?.architectureSignals || [];
  intelSignals.forEach(sig => {
    architectureSignals.push({
      layer: sig.layer || 'Architecture',
      observation: sig.observation || sig.description || '',
      implication: sig.implication || ''
    });
  });
  const manualSignals = assessment.architectureSignals || {};
  Object.entries(manualSignals).forEach(([layer, observation]) => {
    if (layer === 'organisationIntel' || layer === 'renewalCalendar') return;
    const details = Array.isArray(observation) ? observation.join(', ') : observation;
    if (!details) return;
    architectureSignals.push({ layer, observation: details, implication: '' });
  });

  const dataPipelines = coerceList(assessment.operatingModel?.dataPipelines, { limit: 6 });
  const shipperNotes = coerceList(assessment.operatingModel?.dataShippers, { limit: 6 });
  const insightExpectations = coerceList(assessment.operatingModel?.insightExpectations, { limit: 6 });

  const organisationStructure = coerceList(assessment.companyProfile?.organisationStructure, { limit: 8 });
  const talentFocus = assessment.operatingModel?.talentFocus || '';
  const changeManagement = assessment.operatingModel?.changeManagement || '';

  const governanceCadence = assessment.operatingModel?.operatingRhythms || '';
  const processConstraints = assessment.operatingModel?.processConstraints || '';
  const procurement = assessment.operatingModel?.procurementProcess || '';
  const reportingChains = assessment.operatingModel?.reportingChains || assessment.operatingModel?.reportingLines || '';
  const meanTimeToInnocence = assessment.operatingModel?.meanTimeToInnocence || assessment.operatingModel?.mtti || '';

  const roadmapHighlights = Object.entries(roadmap || {}).map(([phase, actions]) => ({
    phase,
    actions: actions.slice(0, 3)
  }));

  return {
    overview: {
      organisation,
      summary,
      competitorSummary,
      strategicDrivers,
      capabilityFocus,
      personaHighlights,
      maturitySignals
    },
    technology: {
      architectureSignals,
      toolingSnapshot: techLandscape,
      vendorSignals: vendorSignals.length ? vendorSignals : technologyRadar.slice(0, 5).map(item => ({
        theme: `${item.pillar} · ${item.category}`,
        vendors: item.vendors,
        note: item.rationale
      })),
      opportunities: (technologyRadar || []).slice(0, 6),
      watchlist: industryInsights.watchlist || []
    },
    data: {
      pipelines: dataPipelines,
      shippers: shipperNotes,
      insightExpectations,
      analyticsFocus: industryInsights.maturitySignals || [],
      valueDrivers: revenueOpportunitiesForSection(revenueOpportunities)
    },
    people: {
      organisationStructure,
      talentFocus,
      changeManagement,
      personas: personaBriefings,
      timelineExpectations: roadmapHighlights
    },
    process: {
      governanceCadence,
      processConstraints,
      procurement,
      reportingChains,
      meanTimeToInnocence,
      riskRegister
    }
  };
}

function revenueOpportunitiesForSection(revenueOpportunities = []) {
  return (revenueOpportunities || []).slice(0, 4).map(item => ({
    pillar: item.pillar,
    score: item.score,
    narrative: item.narrative
  }));
}

function buildValuePathPhases({ assessment, pillarScores, pillarUrgency, capability, roadmap }) {
  const basePhases = Array.isArray(assessment.operatingModel?.valuePath)
    ? assessment.operatingModel.valuePath.slice(0, 4)
    : [];

  const defaultPhases = [
    { name: 'Phase 1 · Mobilise', duration: '0-30 days', urgency: 5 },
    { name: 'Phase 2 · Stabilise', duration: '30-90 days', urgency: 4 },
    { name: 'Phase 3 · Scale', duration: 'Quarter 2', urgency: 3 },
    { name: 'Phase 4 · Optimise', duration: 'Quarter 3+', urgency: 2 }
  ];

  const phases = basePhases.length ? basePhases : defaultPhases;
  const sortedPillars = Object.entries(pillarScores)
    .sort((a, b) => a[1] - b[1])
    .map(([pillar]) => pillar);

  return phases.map((phase, idx) => {
    const focusPillar = sortedPillars[idx % sortedPillars.length] || capability.domains[idx % capability.domains.length] || 'Capability';
    const currentScore = pillarScores[focusPillar] || 0;
    const urgency = Number(phase.urgency || pillarUrgency[focusPillar] || 3);
    const maturityLift = clamp(Math.round(urgency * 8), 5, 30);
    const targetScore = clamp(currentScore + maturityLift, 0, 100);
    const roadmapPhase = Object.entries(roadmap || {}).find(([name]) => name.toLowerCase().includes('0-30') && idx === 0)
      || Object.entries(roadmap || {})[idx]
      || [];

    return {
      phase: phase.name || `Phase ${idx + 1}`,
      duration: phase.duration || (roadmapPhase?.[0] ?? ''),
      urgency,
      focusPillar,
      currentScore,
      targetScore,
      maturityLift,
      outcomes: coerceList(phase.outcomes, { limit: 4 }),
      coverageFocus: phase.coverageFocus || `Expand ${focusPillar.toLowerCase()} controls across priority estates.`,
      valueDriver: phase.valueDriver || assessment.operatingModel?.valueDriver || 'Risk'
    };
  });
}

function buildCoverageSummary({ assessment, pillarScores, pillarUrgency, capability, roadmap }) {
  const focusPillars = Object.entries(pillarScores)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 3)
    .map(([pillar, score]) => ({
      pillar,
      score,
      urgency: pillarUrgency[pillar] || 3,
      commentary: `Increase ${pillar.toLowerCase()} maturity from ${score} to ${Math.min(100, score + 20)} with executive sponsorship.`
    }));

  const objectives = coerceList(
    assessment.operatingModel?.discoveryObjectives || assessment.companyProfile?.discoveryObjectives,
    { limit: 6 }
  );

  const roadmapFocus = Object.entries(roadmap || {}).map(([phase, items]) => ({
    phase,
    highlights: items.slice(0, 2)
  }));

  return {
    capability,
    focusPillars,
    objectives,
    roadmapFocus,
    valueLenses: {
      risk: assessment.operatingModel?.riskLens || 'Reduce mean time to innocence and regulatory exposure.',
      revenue: assessment.operatingModel?.revenueLens || 'Unlock data-driven growth use cases tied to strategic drivers.',
      cost: assessment.operatingModel?.costLens || 'Optimise tooling and run costs through automation and FinOps guardrails.'
    }
  };
}

function computeScoreSummary({ answers = {}, vertical = 'generic', companySize }) {
  const pillars = Object.keys(answers);
  const pillarScores = {};
  const pillarUrgency = {};

  for (const pillar of pillars) {
    const rawEntries = Object.values(answers[pillar] || {});
    const maturityValues = rawEntries
      .map(entry => extractMaturityScore(entry))
      .filter(value => value !== null)
      .map(value => clamp(value, 0, 5));
    const urgencyValues = rawEntries
      .map(entry => extractUrgency(entry))
      .filter(value => value !== null);

    const avg = maturityValues.length ? maturityValues.reduce((a, b) => a + b, 0) / maturityValues.length : 0;
    pillarScores[pillar] = Math.round(clamp((avg / 5) * 100));

    if (urgencyValues.length) {
      const urgencyAvg = urgencyValues.reduce((a, b) => a + b, 0) / urgencyValues.length;
      pillarUrgency[pillar] = Number(urgencyAvg.toFixed(2));
    }
  }

  const headlineScore = Math.round(
    clamp(
      Object.values(pillarScores).reduce((a, b) => a + b, 0) /
        (Object.keys(pillarScores).length || 1)
    )
  );

  const verticalKey = vertical || 'generic';
  const bm = loadBenchmarks(verticalKey);

  return {
    pillarScores,
    pillarUrgency,
    headlineScore,
    vertical: verticalKey,
    companySize,
    benchmarks: bm
  };
}

async function computeReport({ assessment }) {
  const stageMap = {
    free: 'insight',
    premium: 'strategic'
  };
  const rawStage = assessment.stage || 'insight';
  const stage = stageMap[rawStage] || rawStage;
  const capability = getCapability(assessment.assessmentType || 'security');

  const baseAnswers = assessment.answers || {};
  const answers = mergeAnswers(
    baseAnswers,
    assessment.premiumAnswers || {},
    assessment.extendedAnswers || {},
    assessment.commandAnswers || {}
  );

  const summary = computeScoreSummary({
    answers,
    vertical: assessment.vertical,
    companySize: assessment.companySize
  });
  const { pillarScores, pillarUrgency, headlineScore, vertical: verticalKey, benchmarks: bm } = summary;
  const verticalLabel = verticalKey === 'generic' ? 'cross-industry peers' : verticalKey.toUpperCase();
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
    const playbook = PLAYBOOKS[pillar]?.[maturity.toLowerCase()] || [];
    const primary = playbook[0] || `${pillar}: Focus initiatives on measurable outcomes.`;
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
    const playbook = PLAYBOOKS[pillar];
    pillarInsights[pillar] = {
      score,
      median,
      percentile,
      maturity,
      commentary:
        score >= median
          ? `Ahead of peers by ${Math.abs(score - median)} pts. Continue scaling automation to solidify leadership.`
          : `Lagging peers by ${Math.abs(score - median)} pts. Prioritise foundational capabilities and ownership to catch up.`,
      quickWins: playbook ? playbook[maturity.toLowerCase()].slice(0, 2) : []
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
      ...focusPillars.map(p => `Implement top initiatives for ${p.toLowerCase()} including tooling enablement and training.`)
    ],
    'Quarter 2+': [
      'Scale cross-functional operating rhythms with OKRs and automation guardrails.',
      ...focusPillars.map(p => `Optimise ${p.toLowerCase()} investments with continuous improvement and ROI tracking.`)
    ]
  };

  const discoveryObjectives = coerceList(
    assessment.operatingModel?.discoveryObjectives || assessment.companyProfile?.discoveryObjectives
  );
  discoveryObjectives.slice(0, 3).forEach((objective, idx) => {
    const phase = idx === 0 ? '0-30 days' : idx === 1 ? '30-90 days' : 'Quarter 2+';
    roadmap[phase].push(`Discovery objective: ${objective}`);
  });

  const keyInitiatives = coerceList(assessment.companyProfile?.keyInitiatives).slice(0, 4);
  keyInitiatives.forEach((initiative, idx) => {
    const phase = idx === 0 ? '0-30 days' : idx === 1 ? '30-90 days' : 'Quarter 2+';
    roadmap[phase].push(`Strategic initiative: ${initiative}`);
  });

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
  const investmentHighlights = coerceList(assessment.companyProfile?.investmentRounds).slice(0, 5);
  if (investmentHighlights.length) {
    investmentOutlook.investmentHighlights = investmentHighlights;
  }

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
  const strategicNarrative = `Agama Technologies experts analysed your ${capability.name} operating model. Drawing on industry research (Gartner, Forrester, MITRE) we identified where AI, security, observability, and analytics can jointly drive modernisation with up to 95% cost optimisation.`;

  const personaBriefings = buildPersonaBriefings({ capability, assessment, pillarScores });
  const riskRegister = buildRiskRegister({ pillarScores, benchmarks, assessment });
  const revenueOpportunities = buildRevenueOpportunities({ pillarScores, assessment });
  const operationalPlan = buildOperationalPlan({ focusPillars, capability, assessment });

  const industryInsights = buildIndustryInsights({ assessment, benchmarks, technologyRadar });
  const vendorEngagements = buildVendorEngagements({ assessment, technologyRadar });
  const deliveryTimeline = buildDeliveryTimeline({
    roadmap,
    initiativeTimeline: assessment.initiativeTimeline || []
  });

  const structuredSections = buildStructuredSections({
    assessment,
    capability,
    summary,
    competitorSummary,
    pillarInsights,
    personaBriefings,
    technologyRadar,
    industryInsights: industryInsights || {},
    riskRegister,
    revenueOpportunities,
    roadmap,
    pillarUrgency
  });

  const valuePath = buildValuePathPhases({
    assessment,
    pillarScores,
    pillarUrgency,
    capability,
    roadmap
  });

  const coverageSummary = buildCoverageSummary({
    assessment,
    pillarScores,
    pillarUrgency,
    capability: capability.name,
    roadmap
  });

  const aiNarrative = await generateExecutiveNarrative({ assessment, report: {
    headlineScore,
    pillarScores,
    recommendations,
    roadmap,
    investmentOutlook,
    personaBriefings,
    riskRegister,
    revenueOpportunities,
    industryInsights
  }, capability });

  let strategicIntelligence = {};
  if (['strategic', 'command'].includes(stage)) {
    strategicIntelligence = await generateStrategicIntelligence({
      stage,
      capability,
      assessment,
      report: {
        headlineScore,
        pillarScores,
        benchmarks,
        industryInsights,
        vendorEngagements,
        investmentOutlook,
        riskRegister,
        revenueOpportunities
      }
    });
  }

  let commandAdvisory = {};
  if (stage === 'command') {
    commandAdvisory = await generateCommandBlueprint({
      capability,
      assessment,
      vendorEngagements,
      deliveryTimeline,
      industryInsights,
      report: {
        roadmap,
        investmentOutlook,
        pillarInsights,
        benchmarks,
        initiativeTimeline: assessment.initiativeTimeline || [],
        architectureUploads: assessment.architectureUploads || [],
        architectureSignals: assessment.architectureSignals || {}
      }
    });
  }

  let architectureAssets = {};
  if (stage !== 'insight') {
    architectureAssets = await generateArchitectureAssets({
      assessment,
      capability,
      report: {
        headlineScore,
        pillarScores,
        roadmap,
        investmentOutlook,
        technologyRadar,
        riskRegister,
        personaBriefings,
        industryInsights,
        vendorEngagements
      }
    });
  }

  return {
    stage,
    vertical: verticalKey,
    assessmentType: assessment.assessmentType,
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
    technologyRadar,
    personaBriefings,
    riskRegister,
    revenueOpportunities,
    operationalPlan,
    aiNarrative,
    industryInsights,
    vendorEngagements,
    deliveryTimeline,
    strategicIntelligence,
    commandAdvisory,
    architectureUploads: assessment.architectureUploads || [],
    architectureSignals: assessment.architectureSignals || {},
    architectureBlueprint: architectureAssets.architectureBlueprint || {},
    roiMap: architectureAssets.roiMap || [],
    renewalCalendar:
      architectureAssets.renewalCalendar ||
      assessment.architectureSignals?.renewalCalendar ||
      assessment.organization?.intel?.profile?.renewalCalendar ||
      [],
    personaIntelligence: architectureAssets.personaIntelligence || {},
    structuredSections,
    valuePath,
    coverageSummary,
    urgencyMap: pillarUrgency
  };
}

module.exports = { computeReport, computeScoreSummary };
