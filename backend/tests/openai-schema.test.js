const {
  ExecutiveNarrativeSchema,
  StrategicIntelligenceSchema,
  CommandBlueprintSchema,
  ArchitectureAssetsSchema,
  FollowUpSchema,
  RfpDraftSchema
} = require('../utils/openai');

describe('LLM schema golden tests', () => {
  test('Executive narrative schema matches golden sample', () => {
    const sample = {
      executiveSummary: ['Focus on platform reliability.', 'Align AI investments to value.', 'Embed governance cadence.'],
      strategicRisks: [
        { risk: 'Fragmented observability', impact: 'Delayed incident response', mitigation: 'Unify telemetry estate' },
        { risk: 'Legacy governance', impact: 'Compliance exposure', mitigation: 'Codify modern controls', timeframe: '0-90 days' }
      ],
      valueRealisation: ['Reduce toil by 20% via automation.', 'Accelerate releases with golden paths.', 'Improve CX with shared KPIs.'],
      personaGuidance: {
        CTO: {
          focus: ['Platform engineering', 'Automation'],
          guidance: ['Fund platform roadmap with dedicated squad.', 'Sponsor reliability scorecard adoption.']
        }
      },
      operatingModel: {
        phases: [
          { phase: 'Stabilise', highlights: ['Baseline telemetry health', 'Stand up command centre'] },
          { phase: 'Scale', highlights: ['Automate release governance', 'Introduce value dashboards'] }
        ]
      }
    };
    expect(() => ExecutiveNarrativeSchema.parse(sample)).not.toThrow();
  });

  test('Strategic intelligence schema matches golden sample', () => {
    const sample = {
      industryHeatmap: [
        { dimension: 'Cloud adoption', rating: 'High', commentary: 'Peers shifting to hybrid multi-cloud.' }
      ],
      maturityNarrative: 'Scaling peers are investing in automation to protect margins.',
      investmentCases: [
        { title: 'Observability command centre', outcome: 'Faster MTTR', payback: '12 months', sponsors: ['CTO'] }
      ],
      riskSignals: [
        { title: 'Regulatory change', trigger: 'New resilience rules', mitigation: 'Codify compliance automation', timeframe: '2025' }
      ]
    };
    expect(() => StrategicIntelligenceSchema.parse(sample)).not.toThrow();
  });

  test('Command blueprint schema matches golden sample', () => {
    const sample = {
      vendorOrchestration: [
        {
          vendor: 'VendorOne',
          pocFocus: ['AI-driven remediation'],
          negotiationMoves: ['Bundle platform and services'],
          pricingWatchouts: ['Usage-based uplift after year one']
        }
      ],
      architectureDirectives: ['Adopt event-driven observability fabric.', 'Enforce policy-as-code guardrails.'],
      executiveTimeline: [
        { phase: '0-90 days', leader: 'CTO', actions: ['Launch control tower', 'Baseline tooling overlap'] }
      ],
      boardTalkingPoints: ['Link automation to resilience KPIs.', 'Frame investment as cost-to-serve optimisation.']
    };
    expect(() => CommandBlueprintSchema.parse(sample)).not.toThrow();
  });

  test('Architecture assets schema matches golden sample', () => {
    const sample = {
      architectureBlueprint: {
        layers: [
          {
            name: 'Experience',
            components: [
              { label: 'Unified dashboards', description: 'Role-based telemetry surfaces', owners: ['Platform team'] }
            ]
          }
        ],
        commentary: 'Prioritise golden signals and automation guardrails.'
      },
      roiMap: [
        {
          initiative: 'Automated remediation',
          valueDrivers: ['Reduced toil'],
          costToImplement: '$450k',
          paybackWindow: '14 months',
          stakeholders: ['SRE lead', 'CFO']
        }
      ],
      renewalCalendar: [
        { vendor: 'LegacyMonitoring', renewalWindow: 'Q1 2025', riskLevel: 'Medium', recommendedAction: 'Plan migration' }
      ],
      personaIntelligence: {
        'Platform Director': {
          summary: 'Needs faster delivery with controls.',
          priorities: ['Developer productivity', 'Reliability'],
          kpis: ['Deployment frequency'],
          questions: ['How will governance scale?']
        }
      }
    };
    expect(() => ArchitectureAssetsSchema.parse(sample)).not.toThrow();
  });

  test('Follow-up prompts schema matches golden sample', () => {
    const sample = {
      prompts: [
        {
          question: 'Which services carry the highest customer risk?',
          rationale: 'Quantifies potential incident blast radius.',
          suggestedOptions: ['Payments', 'Login']
        }
      ]
    };
    expect(() => FollowUpSchema.parse(sample)).not.toThrow();
  });

  test('RFP draft schema matches golden sample', () => {
    const sample = {
      capability: 'Platform Engineering',
      industry: 'Fintech',
      criteria: [
        { title: 'Automation coverage', weight: 40, description: 'Depth of policy-as-code and remediation features.' },
        { title: 'Integration ecosystem', weight: 30 }
      ],
      questions: [
        { section: 'Operating model', prompt: 'Describe your support for multi-cloud governance.', guidance: 'Include real client deployments.' }
      ],
      scoringRubric: { automation: { excellent: 'Closed-loop with analytics' } },
      timeline: {
        phases: [
          { name: 'Vendor workshops', durationWeeks: 4, activities: ['Use-case deep dive', 'Architecture validation'] }
        ],
        targetLaunch: 'Q3 2025'
      },
      stakeholders: [
        { name: 'CTO', role: 'Sponsor' },
        { name: 'Head of Operations', role: 'Evaluator' }
      ]
    };
    expect(() => RfpDraftSchema.parse(sample)).not.toThrow();
  });
});
