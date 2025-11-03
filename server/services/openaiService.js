import OpenAI from 'openai';

const apiKey = process.env.OPENAI_API_KEY;
let client = null;

if (apiKey) {
  client = new OpenAI({ apiKey });
}

const invokeModel = async (systemPrompt, userPrompt) => {
  if (!client) {
    return null;
  }
  try {
    const response = await client.responses.create({
      model: 'gpt-4.1-mini',
      temperature: 0.1,
      reasoning: { effort: 'medium' },
      input: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userPrompt
        }
      ]
    });

    const output = response.output?.[0]?.content?.[0]?.text;
    return output ? JSON.parse(output) : null;
  } catch (err) {
    console.error('OpenAI invocation failed', err);
    return null;
  }
};

const fallback = (payload) => payload;

export const generateAssessmentModel = async (industry, size, domains = []) => {
  const systemPrompt =
    'You are Agama Assessment Author. Respond with JSON only. Use vendor-agnostic, evidence-referenced tone.';
  const userPrompt = `Generate schema for industry="${industry}" size="${size}" domains=${JSON.stringify(
    domains
  )}.`;
  const result = await invokeModel(systemPrompt, userPrompt);
  return result || fallback({
    type: 'custom',
    version: 'draft-1',
    schema: {
      sections: domains.map((domain, index) => ({
        id: `${domain.toLowerCase()}-${index + 1}`,
        title: domain,
        weight: 1,
        questions: [
          {
            id: `${domain.toLowerCase()}-q1`,
            type: 'scale',
            text: `Rate ${domain} maturity (1-5)` ,
            weight: 1,
            level_map: {
              '1': 'Initial',
              '5': 'Optimised'
            }
          }
        ]
      }))
    }
  });
};

export const draftRfx = async (projectId, contextIds = []) => {
  const result = await invokeModel(
    'You are Agama RFX generator. Output JSON with sections/questions referencing context IDs only.',
    `Project ${projectId} context ids ${contextIds.join(', ')}`
  );
  return (
    result || {
      title: 'Generated RFX',
      sections: [
        {
          id: 'business-context',
          title: 'Business Context',
          questions: [
            { id: 'bc-1', type: 'text', text: 'Describe your current state.', weight: 1 }
          ]
        }
      ],
      weights: { 'business-context': 1 }
    }
  );
};

export const autoscoreVendorResponse = async (rfxId, vendorResponseId) => {
  const result = await invokeModel(
    'You are Agama autoscore engine. Return JSON with bySection and overall scores. Cite evidence ids only.',
    `Score vendor response ${vendorResponseId} for rfx ${rfxId}`
  );
  return (
    result || {
      bySection: { overall: 3.5 },
      overall: 3.5,
      summary: 'Auto-score placeholder pending full AI integration.'
    }
  );
};

export const composeComparisonNarrative = async (rfxId, comparisonId) => {
  const result = await invokeModel(
    'You are Agama comparison narrator. Produce JSON { narrative, highlights[] } referencing evidence IDs.',
    `Comparison ${comparisonId} for rfx ${rfxId}`
  );
  return (
    result || {
      narrative: 'Vendor A leads due to stronger alignment with weighted requirements.',
      highlights: ['Vendor A excels in integration readiness.']
    }
  );
};

export const composeRoadmap = async (projectId, targets) => {
  const result = await invokeModel(
    'You are Agama roadmap composer. Return JSON with initiatives[] and summary. Reference assessment deltas only.',
    `Project ${projectId} targets ${JSON.stringify(targets)}`
  );
  return (
    result || {
      initiatives: [
        {
          id: 'init-1',
          title: 'Establish Foundations',
          description: 'Kick-off governance and architecture baseline.',
          owner: 'Strategy Lead',
          start: new Date().toISOString(),
          end: new Date(Date.now() + 1000 * 60 * 60 * 24 * 90).toISOString(),
          deps: [],
          risk: 'Change saturation',
          kpis: ['Baseline readiness score']
        }
      ]
    }
  );
};

export const structureConsultingNotes = async (sessionId) => {
  const result = await invokeModel(
    'You are Agama consulting copilot. Return JSON { decisions[], risks[], actions[] } referencing note IDs only.',
    `Session ${sessionId}`
  );
  return (
    result || {
      decisions: ['Proceed with phased rollout.'],
      risks: ['Vendor onboarding dependencies.'],
      actions: ['Prepare integration plan.']
    }
  );
};
