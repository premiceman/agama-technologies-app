const INDUSTRIES = [
  'Financial Services & Banking',
  'Insurance & InsurTech',
  'Capital Markets & Trading',
  'Retail & eCommerce',
  'Consumer Packaged Goods',
  'Telecommunications',
  'Media & Entertainment',
  'Gaming & Interactive',
  'Healthcare & Life Sciences',
  'Pharmaceuticals & Biotech',
  'Public Sector & Government',
  'Defense & National Security',
  'Energy, Utilities & Resources',
  'Oil, Gas & Renewables',
  'Manufacturing & Industry 4.0',
  'Automotive & Mobility',
  'Transportation & Logistics',
  'Aerospace & Aviation',
  'Travel, Tourism & Hospitality',
  'Real Estate & Construction',
  'Agriculture & AgriTech',
  'Education & EdTech',
  'Technology & SaaS',
  'Cloud & Managed Service Providers',
  'Professional & Legal Services',
  'Accounting & Advisory',
  'Cyber & Managed Security Services',
  'FinTech & Payments',
  'Non-profit & NGOs'
];

const OFFICIAL_ORGANISATIONS = [
  'Gartner',
  'Forrester',
  'McKinsey Digital',
  'MITRE',
  'NIST',
  'ISACA',
  'SANS Institute',
  'ENISA',
  'ISO',
  'Cloud Security Alliance',
  'OWASP',
  'FIDO Alliance',
  'FINRA',
  'Basel Committee',
  'UK National Cyber Security Centre (NCSC)',
  'DORA (Digital Operational Resilience Act)',
  'HIPAA',
  'PCI Security Standards Council',
  'CSA STAR',
  'SOC 2 / AICPA',
  'FedRAMP',
  'CIS Benchmarks',
  'GCHQ',
  'ISO/IEC 27001',
  'COBIT 2019'
];

const STRATEGIC_DRIVERS = [
  'Regulatory compliance uplift',
  'Improve time to detection & response',
  'Enable platform reliability and uptime',
  'Accelerate AI-assisted operations',
  'Optimise platform cost to serve',
  'Unlock new revenue streams with data & AI',
  'Enhance customer trust & digital experience',
  'Modernise legacy platforms',
  'Consolidate tool sprawl',
  'Strengthen supply chain and third-party risk management'
];

const CAPABILITY_CATALOG = [
  {
    id: 'security',
    name: 'Security & Resilience',
    description: 'Build Zero Trust foundations, modern detection engineering, and cyber resilience with executive guardrails.',
    domains: ['Security', 'Observability', 'AIOps', 'Business Analytics', 'Governance'],
    technologyLandscape: [
      { id: 'firewalls', label: 'Firewalls & Edge Protection', placeholder: 'Palo Alto, Fortinet, Check Point...' },
      { id: 'iam', label: 'Identity, IAM & PAM', placeholder: 'Okta, Azure AD, CyberArk, BeyondTrust...' },
      { id: 'network', label: 'Network Security & Zero Trust', placeholder: 'Zscaler, Netskope, Cisco Duo...' },
      { id: 'siem', label: 'SIEM, UEBA & SOC Platforms', placeholder: 'Splunk, Microsoft Sentinel, QRadar, Sumo Logic...' },
      { id: 'vuln', label: 'Vulnerability & AppSec', placeholder: 'Snyk, Qualys, Tenable, Veracode...' },
      { id: 'threat', label: 'Threat Intel & Response', placeholder: 'CrowdStrike, Mandiant, Recorded Future...' }
    ],
    personas: [
      { id: 'ciso', title: 'Chief Information Security Officer', outcomes: ['Board assurance', 'Risk reduction', 'Investment governance'] },
      { id: 'head_sec', title: 'Head of Security Operations', outcomes: ['SOC efficiency', 'Unified telemetry', 'Playbook automation'] },
      { id: 'sec_analyst', title: 'Security Analyst', outcomes: ['Signal fidelity', 'Automation coverage', 'Upskilling'] }
    ]
  },
  {
    id: 'observability',
    name: 'Observability & Reliability',
    description: 'Elevate SLO-driven operations with holistic telemetry, incident intelligence, and automation.',
    domains: ['Observability', 'AIOps', 'Platform Engineering', 'Business Analytics', 'FinOps'],
    technologyLandscape: [
      { id: 'telemetry', label: 'Telemetry Stack', placeholder: 'Datadog, New Relic, Dynatrace, OpenTelemetry...' },
      { id: 'tracing', label: 'Tracing & Distributed Systems', placeholder: 'Tempo, Jaeger, AWS X-Ray...' },
      { id: 'incident', label: 'Incident Response & Collaboration', placeholder: 'PagerDuty, Opsgenie, ServiceNow, FireHydrant...' },
      { id: 'platform', label: 'Platform & Delivery Tooling', placeholder: 'Kubernetes, ArgoCD, Terraform, GitHub Actions...' },
      { id: 'cost', label: 'FinOps & Spend Management', placeholder: 'CloudHealth, ProsperOps, in-house FinOps dashboards...' }
    ],
    personas: [
      { id: 'cto', title: 'Chief Technology Officer', outcomes: ['Customer reliability', 'Cost-to-serve', 'Innovation velocity'] },
      { id: 'head_sre', title: 'Director of SRE / Platform', outcomes: ['SLO governance', 'Incident automation', 'Scalable runbooks'] },
      { id: 'sre', title: 'Site Reliability Engineer', outcomes: ['Tooling ergonomics', 'Noise reduction', 'Career pathways'] }
    ]
  },
  {
    id: 'aiops',
    name: 'AIOps & Intelligent Automation',
    description: 'Infuse AI through operations, proactive insights, and predictive automation to unlock new capacity.',
    domains: ['AIOps', 'Observability', 'Data & AI', 'Automation', 'Business Analytics'],
    technologyLandscape: [
      { id: 'event', label: 'Event Correlation & Topology', placeholder: 'Moogsoft, BigPanda, ServiceNow AIOps...' },
      { id: 'mlops', label: 'MLOps & ModelOps', placeholder: 'DataRobot, Sagemaker, Vertex AI, MLFlow...' },
      { id: 'automation', label: 'Automation & Orchestration', placeholder: 'RunDeck, StackStorm, Ansible, Airflow...' },
      { id: 'knowledge', label: 'Knowledge & Copilot Platforms', placeholder: 'Confluence, Notion, GitBook, custom GPT copilots...' },
      { id: 'dataops', label: 'DataOps & Streaming', placeholder: 'Kafka, Flink, Snowflake, dbt, Databricks...' }
    ],
    personas: [
      { id: 'cio', title: 'Chief Information Officer', outcomes: ['Productivity uplift', 'Enterprise automation', 'Change management'] },
      { id: 'head_ops', title: 'Head of IT Operations', outcomes: ['MTTR reduction', 'Predictive insights', 'Runbook AI'] },
      { id: 'ai_lead', title: 'Lead Data Scientist / AIOps Architect', outcomes: ['Model performance', 'Data quality', 'Responsible AI'] }
    ]
  },
  {
    id: 'analytics',
    name: 'Analytics, Data & AI Strategy',
    description: 'Create governed insight engines, modern data stacks, and AI-enabled decision intelligence.',
    domains: ['Business Analytics', 'Data & AI', 'Governance', 'AI Safety', 'Operations'],
    technologyLandscape: [
      { id: 'warehouse', label: 'Data Platforms & Warehouses', placeholder: 'Snowflake, BigQuery, Redshift, Databricks...' },
      { id: 'integration', label: 'Data Integration & Pipelines', placeholder: 'Fivetran, Informatica, Azure Data Factory...' },
      { id: 'governance', label: 'Governance & Catalogues', placeholder: 'Collibra, Alation, Atlan, Monte Carlo...' },
      { id: 'bi', label: 'BI, Visualisation & Decision Intelligence', placeholder: 'Looker, Power BI, Tableau, ThoughtSpot...' },
      { id: 'ai', label: 'AI Platform & Model Serving', placeholder: 'Azure ML, Vertex AI, OpenAI API, in-house models...' }
    ],
    personas: [
      { id: 'cdao', title: 'Chief Data & Analytics Officer', outcomes: ['Data monetisation', 'Governance', 'AI strategy'] },
      { id: 'head_bi', title: 'Head of Analytics / BI', outcomes: ['Self-service adoption', 'Data trust', 'Speed to insight'] },
      { id: 'data_engineer', title: 'Lead Data Engineer', outcomes: ['Pipeline reliability', 'Cost efficiency', 'Developer experience'] }
    ]
  }
];

const BASE_MATURITY = {
  Observability: [
    { id: 'obs_strategy', text: 'Service-level objectives (SLOs) defined for top customer journeys', weight: 1 },
    { id: 'obs_trace', text: 'Distributed tracing with >70% critical service coverage', weight: 1 },
    { id: 'obs_automation', text: 'Alerting linked to runbooks with automated suppression', weight: 1 },
    { id: 'obs_finops', text: 'Telemetry cost governance with chargeback/showback', weight: 1 }
  ],
  Security: [
    { id: 'sec_identity', text: 'Identity hardening with MFA, SSO, and privileged access workflows', weight: 1 },
    { id: 'sec_detection', text: 'Threat detection mapped to MITRE ATT&CK with continuous tuning', weight: 1 },
    { id: 'sec_response', text: 'Incident response automation and tabletop exercises quarterly', weight: 1 },
    { id: 'sec_compliance', text: 'Continuous compliance monitoring & evidence automation', weight: 1 }
  ],
  AIOps: [
    { id: 'aiops_topology', text: 'Unified topology & dependency mapping across services', weight: 1 },
    { id: 'aiops_predictive', text: 'Predictive analytics forecasting capacity, risk and performance', weight: 1 },
    { id: 'aiops_remediation', text: 'Automated remediation for recurring incidents and toil', weight: 1 },
    { id: 'aiops_coe', text: 'AIOps centre of excellence with KPIs and adoption program', weight: 1 }
  ],
  'Business Analytics': [
    { id: 'ba_governance', text: 'Data governance, lineage and privacy guardrails enforced', weight: 1 },
    { id: 'ba_self_service', text: 'Curated semantic layer enabling governed self-service', weight: 1 },
    { id: 'ba_experimentation', text: 'Experimentation & causal analysis embedded in delivery', weight: 1 },
    { id: 'ba_value', text: 'Clear measurement of analytics value & revenue impact', weight: 1 }
  ]
};

const PREMIUM_EXTENSIONS = {
  'Platform Engineering': [
    { id: 'platform_idp', text: 'Internal developer platform with paved-path golden workflows', weight: 1 },
    { id: 'platform_security', text: 'Security guardrails baked into CI/CD and infrastructure', weight: 1 },
    { id: 'platform_scalability', text: 'Scalable architecture patterns with capacity headroom', weight: 1 }
  ],
  'People & Skills': [
    { id: 'people_skills', text: 'Skill matrix & enablement aligned to observability / security / AI', weight: 1 },
    { id: 'people_staffing', text: 'Right-sized staffing model with clear role definitions', weight: 1 },
    { id: 'people_partner', text: 'Partner ecosystem supporting specialised capability gaps', weight: 1 }
  ],
  'Process & Governance': [
    { id: 'process_operating', text: 'Integrated operating model across Dev, Sec, Ops, Data', weight: 1 },
    { id: 'process_metrics', text: 'Executive dashboards linking risk, reliability, and revenue', weight: 1 },
    { id: 'process_audit', text: 'Audit-ready evidence trail with policy-as-code enforcement', weight: 1 }
  ],
  'Data & AI': [
    { id: 'data_quality', text: 'Data contracts, quality SLAs, and anomaly detection', weight: 1 },
    { id: 'data_ai_guardrails', text: 'Responsible AI controls and governance in production', weight: 1 },
    { id: 'data_insight', text: 'Closed-loop insight to action workflows for revenue & risk', weight: 1 }
  ],
  'Operations & Automation': [
    { id: 'ops_playbooks', text: 'End-to-end playbooks with automation coverage for top incidents', weight: 1 },
    { id: 'ops_copilot', text: 'Copilot adoption across operations with measurable ROI', weight: 1 },
    { id: 'ops_service_health', text: 'Real-time service health scoring integrated into business reviews', weight: 1 }
  ]
};

const STRATEGIC_EXTENSIONS = {
  'Vendor Strategy & Ecosystem': [
    { id: 'vendor_strategy', text: 'Vendor strategy is vendor-agnostic with competitive tension maintained', weight: 1 },
    { id: 'vendor_otel', text: 'Observability stack embraces OpenTelemetry and open standards for portability', weight: 1 },
    { id: 'vendor_value', text: 'Commercial models measured quarterly against value delivered and renegotiated proactively', weight: 1 }
  ],
  'Data, People & Process': [
    { id: 'data_ops_alignment', text: 'Data teams operate against shared OKRs with security/ops counterparts', weight: 1 },
    { id: 'process_kpis', text: 'Transformation KPIs cascade from executive objectives to squad scorecards', weight: 1 },
    { id: 'people_enablement', text: 'Enablement programmes and certifications exist for each stakeholder persona', weight: 1 }
  ],
  'Investment & Value Management': [
    { id: 'investment_governance', text: 'Investment reviews tie initiatives to measurable ROI and risk reduction', weight: 1 },
    { id: 'finops_maturity', text: 'FinOps practices optimise spend across cloud, tooling, and automation', weight: 1 },
    { id: 'portfolio_prioritisation', text: 'Portfolio decisions balance innovation with resilience guardrails', weight: 1 }
  ]
};

const COMMAND_EXTENSIONS = {
  'Architecture & Resilience': [
    { id: 'architecture_blueprints', text: 'Target-state architecture diagrams are maintained with version control and executive sign-off', weight: 1 },
    { id: 'architecture_reviews', text: 'Architecture reviews integrate cyber, reliability, and data risks with quantitative scoring', weight: 1 },
    { id: 'resilience_testing', text: 'Resilience scenarios (chaos, tabletop, CVE simulations) are executed quarterly', weight: 1 }
  ],
  'Vendor Execution & Assurance': [
    { id: 'vendor_poc', text: 'POC scopes for critical vendors include success metrics, exit criteria, and run cost benchmarks', weight: 1 },
    { id: 'vendor_due_diligence', text: 'Third-party risk assessments cover supply chain, SOC2/ISO posture, and response SLAs', weight: 1 },
    { id: 'vendor_questions', text: 'Vendor scorecards include interrogation questions on roadmap, pricing levers, and integration depth', weight: 1 }
  ],
  'Change Leadership & Adoption': [
    { id: 'adoption_playbooks', text: 'Adoption playbooks align executive storytelling, metrics, and communications cadence', weight: 1 },
    { id: 'talent_transitions', text: 'Workforce transition plans cover reskilling, redeployment, and partner augmentation', weight: 1 },
    { id: 'governance_council', text: 'A transformation council tracks benefits, risks, and vendor delivery on a monthly rhythm', weight: 1 }
  ]
};

const MATURITY_QUESTIONNAIRE = {
  free: BASE_MATURITY,
  premium: { ...BASE_MATURITY, ...PREMIUM_EXTENSIONS },
  insight: BASE_MATURITY,
  strategic: { ...BASE_MATURITY, ...PREMIUM_EXTENSIONS, ...STRATEGIC_EXTENSIONS },
  command: {
    ...BASE_MATURITY,
    ...PREMIUM_EXTENSIONS,
    ...STRATEGIC_EXTENSIONS,
    ...COMMAND_EXTENSIONS
  }
};

const PERSONA_BLUEPRINTS = CAPABILITY_CATALOG.reduce((acc, cap) => {
  acc[cap.id] = cap.personas;
  return acc;
}, {});

function getQuestionnaire(stage = 'free') {
  return MATURITY_QUESTIONNAIRE[stage] || MATURITY_QUESTIONNAIRE.free;
}

function getCapability(id = 'security') {
  return CAPABILITY_CATALOG.find(item => item.id === id) || CAPABILITY_CATALOG[0];
}

module.exports = {
  INDUSTRIES,
  OFFICIAL_ORGANISATIONS,
  STRATEGIC_DRIVERS,
  CAPABILITY_CATALOG,
  MATURITY_QUESTIONNAIRE,
  getQuestionnaire,
  getCapability,
  PERSONA_BLUEPRINTS
};
