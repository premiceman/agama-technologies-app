const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

async function callOpenAI({ system, user, responseFormat = { type: 'json_object' } }) {
  if (!OPENAI_API_KEY) {
    return null;
  }
  try {
    const body = {
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.4,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ]
    };
    if (responseFormat) {
      body.response_format = responseFormat;
    }
    const res = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify(body)
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

async function searchOrganizationProfiles({ query, capability, industry }) {
  if (!OPENAI_API_KEY) {
    return { matches: [] };
  }
  const system = `You are an enterprise intelligence analyst. Return JSON {matches: [{name, ticker, hqRegion, description, classification, industryTags, employeeRange, headcountEstimate, annualRevenueEstimate, turnover, fundingRounds, investmentHighlights, keyInitiatives, organisationStructure, discoveryObjectives, personaKpis, sources}], confidenceNote}. Provide factual, recent public data (<= 2024). If unsure, include null values and note low confidence. Limit matches to 4.`;
  const user = `Organisation lookup request.
Query: ${query}
Relevant capability: ${capability || 'enterprise transformation'}
Industry context: ${industry || 'general'}
Return best-matching publicly known organisations.`;
  const resp = await callOpenAI({ system, user });
  if (!resp) {
    return {
      matches: [],
      confidenceNote: 'Organisation enrichment disabled. Configure OPENAI_API_KEY to unlock auto-complete.'
    };
  }
  resp.matches = Array.isArray(resp.matches) ? resp.matches : [];
  return resp;
}

async function fetchOrganizationIntel({ organization, assessmentType, industry }) {
  const system = `You synthesise analyst, regulatory, and funding intelligence for enterprise technology initiatives. Respond in JSON with keys summary, dominantFrameworks, vendorSignals, profile.
- summary: string (2 sentences)
- dominantFrameworks: array of {name, guidance}
- vendorSignals: array of {theme, leadingVendors, investmentNotes}
- profile: {
    canonicalName,
    classification,
    industryTags,
    headcountEstimate,
    employeeRange,
    annualRevenueEstimate,
    turnover,
    fundingRounds: array of {round, amount, date, leadInvestors},
    investmentHighlights: array of strings,
    keyInitiatives: array of {name, objective, horizon, description},
    organisationStructure: array of {function, leader, remit, primaryKpis},
    discoveryObjectives: array of {objective, linkedKpis, timeframe},
    personaKpis: object map of persona -> array of KPIs,
    renewalCalendar: array of {vendor, renewalWindow, action},
    architectureSignals: array of {layer, observation, implication},
    dataConfidence,
    sources
  }
Return only substantiated insights (<= 2024). If confidence is low, populate dataConfidence with explanation and leave uncertain fields null.`;
  const user = `Provide official perspectives and organisational intelligence for ${organization} focusing on ${assessmentType} programmes in the ${industry || 'cross-industry'} domain.`;
  const resp = await callOpenAI({ system, user });
  if (!resp) {
    return {
      summary: `External research for ${organization} unavailable. Configure OPENAI_API_KEY to enable automatic enrichment.`,
      dominantFrameworks: [],
      vendorSignals: [],
      profile: {
        canonicalName: organization,
        classification: 'Unknown',
        industryTags: [industry].filter(Boolean),
        dataConfidence: 'OpenAI enrichment disabled.',
        sources: []
      }
    };
  }
  if (resp.profile && !Array.isArray(resp.profile.industryTags) && resp.profile.industryTags) {
    resp.profile.industryTags = String(resp.profile.industryTags).split(/,|;|\n/).map(s => s.trim()).filter(Boolean);
  }
  return resp;
}

async function generateArchitectureAssets({ assessment, report, capability }) {
  if (!OPENAI_API_KEY) {
    return {};
  }
  const system = `You are an enterprise architect producing board-ready blueprints. Respond in JSON with keys:
- architectureBlueprint: {layers: [{name, components: [{label, description, owners}]}], commentary}
- roiMap: array of {initiative, valueDrivers, costToImplement, paybackWindow, stakeholders}
- renewalCalendar: array of {vendor, renewalWindow, riskLevel, recommendedAction}
- personaIntelligence: object where key is persona id or title and value is {summary, priorities, kpis, questions, visualNarrative}
Ground responses in the provided assessment, organisation intel, and roadmap.`;
  const payload = {
    organisation: assessment.organization?.name,
    organisationIntel: assessment.organization?.intel || {},
    companyProfile: assessment.companyProfile || {},
    strategicDrivers: assessment.strategicDrivers || [],
    roadmap: report.roadmap,
    investmentOutlook: report.investmentOutlook,
    personas: assessment.personas || [],
    capability: capability.name,
    pillarScores: report.pillarScores,
    pillarInsights: report.pillarInsights,
    technologyRadar: report.technologyRadar,
    riskRegister: report.riskRegister
  };
  const user = `Create architecture visuals, ROI mapping, and renewal priorities for this engagement:${JSON.stringify(payload)}`;
  const resp = await callOpenAI({ system, user });
  return resp || {};
}

async function generateFollowUpPrompts({ step, capability, answers, organization, industry }) {
  if (!OPENAI_API_KEY) {
    return { prompts: [] };
  }
  const system = `You are a senior transformation consultant embedded in Agama's assessment wizard. Suggest clarifying follow-up questions to gather deeper context. Respond in JSON {prompts: [{question, rationale, suggestedOptions?}]}. Keep it grounded in provided answers.`;
  const payload = {
    step,
    capability,
    organization,
    industry,
    answers
  };
  const user = `Based on this intake step, craft up to 3 targeted follow-up prompts to remove ambiguity. Answers so far: ${JSON.stringify(payload)}`;
  const resp = await callOpenAI({ system, user });
  if (!resp || !Array.isArray(resp.prompts)) {
    return { prompts: [] };
  }
  resp.prompts = resp.prompts.slice(0, 3).map(prompt => ({
    question: prompt.question || 'Provide additional context for this step.',
    rationale: prompt.rationale || 'Clarify this area to strengthen the tailored recommendations.',
    suggestedOptions: Array.isArray(prompt.suggestedOptions) ? prompt.suggestedOptions.slice(0, 5) : []
  }));
  return resp;
}

async function generateAssessmentAssistantReply({ message, assessmentDraft, capability }) {
  if (!OPENAI_API_KEY) {
    return {
      answer:
        'The assessment assistant is offline. Configure OPENAI_API_KEY to unlock contextual guidance and live Q&A.'
    };
  }
  const system = `You are Agama Technologies' assessment copilot. Answer with concise, actionable guidance grounded only in the provided assessment draft. Use markdown bullet lists where useful. If information is missing, state assumptions and invite the user to capture it in the relevant step.`;
  const payload = {
    capability,
    assessmentDraft
  };
  const user = `User question: ${message}\n\nContext JSON:${JSON.stringify(payload)}`;
  const content = await callOpenAI({ system, user, responseFormat: null });
  return { answer: content || 'No response available right now.' };
}

module.exports = {
  callOpenAI,
  generateExecutiveNarrative,
  generateStrategicIntelligence,
  generateCommandBlueprint,
  fetchOrganizationIntel,
  searchOrganizationProfiles,
  generateArchitectureAssets,
  generateFollowUpPrompts,
  generateAssessmentAssistantReply
};
