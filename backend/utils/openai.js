const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

async function callOpenAI({ system, user, responseFormat = { type: 'json_object' } }) {
  if (!OPENAI_API_KEY) {
    return null;
  }
  try {
    const res = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.4,
        response_format: responseFormat,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ]
      })
    });
    if (!res.ok) {
      const text = await res.text();
      console.error('OpenAI API error', text);
      return null;
    }
    const json = await res.json();
    const content = json.choices?.[0]?.message?.content || '';
    if (responseFormat?.type === 'json_object') {
      try {
        return JSON.parse(content);
      } catch (err) {
        console.warn('Failed to parse OpenAI JSON content', err);
        return null;
      }
    }
    return content;
  } catch (err) {
    console.error('OpenAI API call failed', err);
    return null;
  }
}

async function generateExecutiveNarrative({ assessment, report, capability }) {
  const system = `You are Agama Technologies' executive intelligence engine. Craft concise, board-ready narratives with numbered recommendations. Output JSON.`;
  const payload = {
    organisation: assessment.organization?.name || 'Unknown organisation',
    industry: assessment.industry || assessment.vertical,
    assessmentType: assessment.assessmentType,
    stage: assessment.stage,
    strategicDrivers: assessment.strategicDrivers || [],
    capabilityFocus: assessment.capabilityFocus || [],
    companyProfile: assessment.companyProfile || {},
    techLandscape: assessment.techLandscape || {},
    vendorStrategy: assessment.vendorStrategy || {},
    operatingModel: assessment.operatingModel || {},
    architectureSignals: assessment.architectureSignals || {},
    personas: assessment.personas || [],
    officialExtract: assessment.organization?.extract || '',
    officialIntel: assessment.organization?.intel || {},
    headlineScore: report.headlineScore,
    pillarScores: report.pillarScores,
    recommendations: report.recommendations,
    roadmap: report.roadmap,
    investmentOutlook: report.investmentOutlook,
    personaBriefings: report.personaBriefings,
    riskRegister: report.riskRegister,
    revenueOpportunities: report.revenueOpportunities,
    capability
  };
  const user = `Create a premium enterprise assessment narrative using Gartner-style tone. Provide executiveSummary (3 bullets), strategicRisks (3 items with risk, impact, mitigation), valueRealisation (3 bullets linking to revenue/cost/experience), personaGuidance (map persona title -> two bullet guidance), and operatingModel (phases with highlights). Base it strictly on this JSON:\n\n${JSON.stringify(payload)}\n`;
  const resp = await callOpenAI({ system, user });
  if (!resp) {
    return {
      executiveSummary: [
        'Executive AI summary requires OpenAI configuration. Configure OPENAI_API_KEY to unlock narrative intelligence.'
      ]
    };
  }
  return resp;
}

async function generateStrategicIntelligence({ stage, assessment, report, capability }) {
  if (!OPENAI_API_KEY) {
    return {};
  }
  const system = `You are a senior McKinsey-style consultant creating industry intelligence packs. Respond in JSON with keys industryHeatmap (array of {dimension, rating, commentary}), maturityNarrative (string), investmentCases (array of {title, outcome, payback, sponsors}), riskSignals (array of {title, trigger, mitigation, timeframe}).`;
  const user = `Stage: ${stage}. Capability: ${capability.name}. Use the following JSON to ground recommendations: ${JSON.stringify({
    assessment: {
      industry: assessment.industry,
      companySize: assessment.companySize,
      region: assessment.region,
      personas: assessment.personas,
      strategicDrivers: assessment.strategicDrivers,
      stakeholderProfile: assessment.stakeholderProfile,
      investmentProfile: assessment.investmentProfile,
      architectureSignals: assessment.architectureSignals
    },
    report
  })}`;
  const resp = await callOpenAI({ system, user });
  return resp || {};
}

async function generateCommandBlueprint({ assessment, capability, vendorEngagements, deliveryTimeline, industryInsights, report }) {
  if (!OPENAI_API_KEY) {
    return {};
  }
  const system = `You are an elite transformation partner building a board-level command deck. Respond in JSON with keys vendorOrchestration (array of {vendor, pocFocus, negotiationMoves, pricingWatchouts}), architectureDirectives (array of strings), executiveTimeline (array of {phase, leader, actions}), boardTalkingPoints (array of strings).`;
  const payload = {
    assessment: {
      industry: assessment.industry,
      region: assessment.region,
      personas: assessment.personas,
      architectureUploads: assessment.architectureUploads,
      initiativeTimeline: assessment.initiativeTimeline,
      vendorStrategy: assessment.vendorStrategy,
      operatingModel: assessment.operatingModel,
      architectureSignals: assessment.architectureSignals
    },
    capability: capability.name,
    vendorEngagements,
    deliveryTimeline,
    industryInsights,
    report
  };
  const user = `Create a command blueprint for the executive team using this JSON: ${JSON.stringify(payload)}. Keep guidance decisive, financially grounded, and reference transformation leadership best practices.`;
  const resp = await callOpenAI({ system, user });
  return resp || {};
}

async function fetchOrganizationIntel({ organization, assessmentType, industry }) {
  const system = `You synthesise official maturity frameworks into concise intelligence. Output JSON with keys summary, dominantFrameworks, vendorSignals.`;
  const user = `Summarise official perspectives from ${organization} relevant to ${assessmentType} initiatives in the ${industry} industry. Provide:
  - summary: 2 sentence overview
  - dominantFrameworks: array of {name, guidance}
  - vendorSignals: array of {theme, leadingVendors, investmentNotes}
Use publicly documented knowledge from the organisation. If information is limited, state that explicitly.`;
  const resp = await callOpenAI({ system, user });
  if (!resp) {
    return {
      summary: `External research for ${organization} unavailable. Configure OPENAI_API_KEY to enable automatic enrichment.`,
      dominantFrameworks: [],
      vendorSignals: []
    };
  }
  return resp;
}

module.exports = {
  callOpenAI,
  generateExecutiveNarrative,
  generateStrategicIntelligence,
  generateCommandBlueprint,
  fetchOrganizationIntel
};
