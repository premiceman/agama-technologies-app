function computeProjectAnalyticsSnapshot({
  stage,
  riskAppetite,
  strategicDrivers = [],
  capabilityFocus = [],
  companyProfile = {},
  operatingModel = {}
} = {}) {
  const stageScores = {
    'Discovery & Fit': 42,
    'Mobilising programme': 56,
    'Scaling transformation': 72,
    'Optimising value': 84
  };
  const riskScores = {
    Conservative: -6,
    Balanced: 0,
    'Bold innovation': 8
  };
  const base = stageScores[stage] || 40;
  const risk = riskScores[riskAppetite] || 0;
  const driverContribution = Math.min(strategicDrivers.length * 6, 24);
  const focusContribution = Math.min(capabilityFocus.length * 5, 20);
  const readinessScore = Math.max(
    35,
    Math.min(base + risk + driverContribution + focusContribution, 96)
  );

  const narrativeSignals = [
    companyProfile.executiveObjectives,
    companyProfile.narrativeContext,
    companyProfile.complianceDrivers
  ].filter(Boolean).length;
  const governanceSignals = [
    operatingModel.governanceRhythms,
    operatingModel.changeManagement,
    operatingModel.processNotes
  ].filter(Boolean).length;
  const clarityScore = Math.min(45 + narrativeSignals * 12 + governanceSignals * 8, 95);

  const sentiment =
    readinessScore >= 80
      ? 'Programme is change-ready with strong acceleration potential.'
      : readinessScore >= 60
        ? 'Momentum forming—reinforce governance and stakeholder choreography.'
        : 'Establish foundational guardrails before expanding the programme.';

  return {
    readinessScore,
    clarityScore,
    sentiment,
    driverCount: strategicDrivers.length,
    focusCount: capabilityFocus.length,
    stage,
    riskAppetite
  };
}

module.exports = { computeProjectAnalyticsSnapshot };
