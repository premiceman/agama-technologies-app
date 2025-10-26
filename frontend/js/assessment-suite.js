const form = document.getElementById('assessmentWizard');
const tierCards = document.querySelectorAll('.tier-card');
const sections = Array.from(document.querySelectorAll('.wizard-section'));
const progressBar = document.getElementById('wizardProgress');
const stepContainer = document.getElementById('wizardSteps');
const valuePulse = document.getElementById('valuePulse');
const nextBtn = document.getElementById('nextStep');
const prevBtn = document.getElementById('prevStep');
const submitBtn = document.getElementById('submitWizard');
const capabilityOptions = document.getElementById('capabilityOptions');
const capabilityFocusSelect = document.getElementById('capabilityFocus');
const strategicDriversWrap = document.getElementById('strategicDrivers');
const techLandscapeWrap = document.getElementById('techLandscape');
const personaWrap = document.getElementById('personaOptions');
const questionnaireWrap = document.getElementById('questionnaire');
const industrySelect = document.getElementById('industry');
const orgSelect = document.getElementById('officialOrg');
const architectureInput = document.getElementById('architectureUploads');
const architecturePreview = document.getElementById('architecturePreview');
const timelineList = document.getElementById('timelineList');
const addInitiativeBtn = document.getElementById('addInitiative');

const projectLauncher = document.getElementById('projectLauncher');
const projectSelect = document.getElementById('projectSelect');
const projectAnalyticsPreview = document.getElementById('projectAnalyticsPreview');
const analyticsPanel = document.getElementById('projectAnalyticsPanel');
const analyticsEmptyState = document.getElementById('analyticsEmptyState');
const analyticsContent = document.getElementById('analyticsContent');
const analyticsMaturityRow = document.getElementById('analyticsMaturityRow');
const analyticsBusinessRow = document.getElementById('analyticsBusinessRow');
const analyticsDriversRow = document.getElementById('analyticsDriversRow');
const launchProjectWizardBtn = document.getElementById('launchProjectWizard');
const replayProjectTourBtn = document.getElementById('replayProjectTour');
const projectOverlay = document.getElementById('projectOnboarding');
const projectWizardProgress = document.getElementById('projectWizardProgress');
const projectSections = Array.from(projectOverlay?.querySelectorAll('.onboarding-section') || []);
const projectNextBtn = document.getElementById('projectNext');
const projectPrevBtn = document.getElementById('projectPrev');
const projectSkipBtn = document.getElementById('projectSkipTour');
const projectCloseBtn = document.getElementById('closeProjectWizard');
const projectTourInsight = document.getElementById('projectTourInsight');
const projectFoundationInsight = document.getElementById('projectFoundationInsight');
const projectStrategyInsight = document.getElementById('projectStrategyInsight');
const projectSummaryInsight = document.getElementById('projectSummaryInsight');
const projectReadinessScore = document.getElementById('projectReadinessScore');
const projectClarityScore = document.getElementById('projectClarityScore');
const projectSentiment = document.getElementById('projectSentiment');
const projectIndustrySelect = document.getElementById('projectIndustry');
const projectRegionTiles = document.getElementById('projectRegionTiles');
const projectSizeTiles = document.getElementById('projectSizeTiles');
const projectStageTiles = document.getElementById('projectStageTiles');
const projectRiskTiles = document.getElementById('projectRiskTiles');
const projectDriverTiles = document.getElementById('projectDriverTiles');
const projectCapabilityTiles = document.getElementById('projectCapabilityTiles');
const projectRegionInput = document.getElementById('projectRegion');
const projectSizeInput = document.getElementById('projectSize');
const projectStageInput = document.getElementById('projectStage');
const projectRiskInput = document.getElementById('projectRisk');
const projectNameInput = document.getElementById('projectName');
const projectDomainInput = document.getElementById('projectDomain');
const projectHeadcountInput = document.getElementById('projectHeadcount');
const projectRevenueInput = document.getElementById('projectRevenue');
const projectBudgetInput = document.getElementById('projectBudget');
const projectObjectivesInput = document.getElementById('projectObjectives');
const projectComplianceInput = document.getElementById('projectCompliance');
const projectNarrativeInput = document.getElementById('projectNarrative');
const projectGovernanceInput = document.getElementById('projectGovernance');
const projectDiscoveryInput = document.getElementById('projectDiscovery');
const projectPersonasInput = document.getElementById('projectPersonas');

const tierBadgeEl = document.getElementById('tierBadge');
const tierLabels = {
  free: 'Insight Pulse',
  strategic: 'Strategic',
  command: 'Command'
};
let currentEntitlement = null;

const formCompanySizeTiles = document.getElementById('formCompanySizeTiles');
const formRegionTiles = document.getElementById('formRegionTiles');
const formStageTiles = document.getElementById('formStageTiles');
const formRiskTiles = document.getElementById('formRiskTiles');

const compactCurrency = typeof Intl !== 'undefined'
  ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 })
  : null;
const compactNumber = typeof Intl !== 'undefined'
  ? new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })
  : null;

function applyEntitlement(entitlement) {
  if (!entitlement) return;
  currentEntitlement = entitlement;
  if (tierBadgeEl) {
    const tier = String(entitlement.tier || 'free').toLowerCase();
    const label = tierLabels[tier] || tier;
    tierBadgeEl.textContent = `${label} tier`;
    if (entitlement.expiresAt) {
      const expires = new Date(entitlement.expiresAt);
      tierBadgeEl.title = `Access until ${expires.toLocaleDateString()}`;
    } else {
      tierBadgeEl.removeAttribute('title');
    }
  }
}

function showAnalyticsMessage(message) {
  if (!analyticsEmptyState || !analyticsContent) return;
  analyticsEmptyState.textContent = message;
  analyticsEmptyState.classList.remove('d-none');
  analyticsContent.classList.add('d-none');
}

function revealAnalyticsContent() {
  if (!analyticsEmptyState || !analyticsContent) return;
  analyticsEmptyState.classList.add('d-none');
  analyticsContent.classList.remove('d-none');
}

function formatScore(value) {
  if (!Number.isFinite(value)) return '--';
  return Math.round(value).toString();
}

function formatDelta(delta) {
  if (!Number.isFinite(delta)) return '--';
  const rounded = Number(delta.toFixed(1));
  const prefix = rounded > 0 ? '+' : '';
  return `${prefix}${rounded}`;
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return '--';
  const rounded = Number(value.toFixed(1));
  const prefix = rounded > 0 ? '+' : '';
  return `${prefix}${rounded}%`;
}

function formatCurrency(value) {
  if (!Number.isFinite(value)) return '--';
  if (compactCurrency) return compactCurrency.format(value);
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return `$${Math.round(value)}`;
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return '--';
  if (compactNumber) return compactNumber.format(value);
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return Math.round(value).toString();
}

function computeYoYPercent(series = []) {
  if (!Array.isArray(series) || series.length < 2) return null;
  const sorted = series.slice().sort((a, b) => a.year - b.year);
  const prev = sorted[sorted.length - 2];
  const curr = sorted[sorted.length - 1];
  if (!prev || !curr) return null;
  if (!Number.isFinite(prev.value) || !Number.isFinite(curr.value) || prev.value === 0) return null;
  return ((curr.value - prev.value) / Math.abs(prev.value)) * 100;
}

function computeArrPerEmployee(arrSeries = [], headcountSeries = []) {
  if (!arrSeries.length || !headcountSeries.length) return null;
  const latestArr = arrSeries.slice().sort((a, b) => a.year - b.year).pop();
  if (!latestArr || !Number.isFinite(latestArr.value)) return null;
  const matchingHeadcount = headcountSeries.find(entry => entry.year === latestArr.year) || headcountSeries.slice().sort((a, b) => a.year - b.year).pop();
  if (!matchingHeadcount || !Number.isFinite(matchingHeadcount.value) || matchingHeadcount.value <= 0) return null;
  return latestArr.value / matchingHeadcount.value;
}

function createSparklineSvg(points = []) {
  const valid = points
    .map(point => ({ value: Number(point?.value), computedAt: point?.computedAt }))
    .filter(point => Number.isFinite(point.value));
  if (!valid.length) return null;
  const width = 120;
  const height = 18;
  const min = Math.min(...valid.map(point => point.value));
  const max = Math.max(...valid.map(point => point.value));
  const span = max - min || 1;
  const step = valid.length > 1 ? width / (valid.length - 1) : width;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('w-100');

  let pathData = '';
  let lastX = 0;
  let lastY = height / 2;
  valid.forEach((point, index) => {
    const x = valid.length > 1 ? index * step : width / 2;
    const relative = (point.value - min) / span;
    const y = height - relative * (height - 2) - 1;
    pathData += index === 0 ? `M${x},${y}` : ` L${x},${y}`;
    lastX = x;
    lastY = y;
  });

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', pathData);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'var(--brand)');
  path.setAttribute('stroke-width', '1.6');
  path.setAttribute('stroke-linecap', 'round');
  svg.appendChild(path);

  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', lastX);
  circle.setAttribute('cy', lastY);
  circle.setAttribute('r', 2);
  circle.setAttribute('fill', 'var(--brand)');
  svg.appendChild(circle);

  return svg;
}

function buildBusinessTile({ label, value, yoy, series }) {
  const card = document.createElement('div');
  card.className = 'card glass p-3 h-100';
  const header = document.createElement('div');
  header.className = 'd-flex justify-content-between align-items-start gap-3';
  const labelWrap = document.createElement('div');
  const labelEl = document.createElement('div');
  labelEl.className = 'text-uppercase small text-fg-3';
  labelEl.textContent = label;
  const valueEl = document.createElement('div');
  valueEl.className = 'fs-4 fw-bold';
  valueEl.textContent = value;
  const yoyEl = document.createElement('div');
  yoyEl.className = 'small text-fg-3';
  yoyEl.textContent = yoy === '--' ? 'YoY --' : `YoY ${yoy}`;
  labelWrap.appendChild(labelEl);
  labelWrap.appendChild(valueEl);
  labelWrap.appendChild(yoyEl);

  const sparklineWrap = document.createElement('div');
  const svg = createSparklineSvg(series);
  if (svg) sparklineWrap.appendChild(svg);

  header.appendChild(labelWrap);
  header.appendChild(sparklineWrap);
  card.appendChild(header);
  return card;
}

function formatDateRange(startDate, endDate) {
  if (!startDate && !endDate) return '';
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;
  const startLabel = start && !Number.isNaN(start.valueOf()) ? start.toLocaleDateString() : '';
  const endLabel = end && !Number.isNaN(end.valueOf()) ? end.toLocaleDateString() : '';
  if (startLabel && endLabel) return `${startLabel} → ${endLabel}`;
  return startLabel || endLabel;
}

function renderMaturityAnalytics(summary) {
  if (!analyticsMaturityRow) return;
  analyticsMaturityRow.innerHTML = '';
  const entries = [
    { key: 'overall', label: 'Overall' },
    { key: 'Tech', label: 'Tech' },
    { key: 'Data', label: 'Data' },
    { key: 'People', label: 'People' },
    { key: 'Process', label: 'Process' }
  ];
  entries.forEach(entry => {
    const col = document.createElement('div');
    col.className = 'col-md';
    const card = document.createElement('div');
    card.className = 'card glass p-3 h-100';

    const header = document.createElement('div');
    header.className = 'd-flex justify-content-between align-items-start gap-3';

    const labelWrap = document.createElement('div');
    const label = document.createElement('div');
    label.className = 'text-uppercase small text-fg-3';
    label.textContent = entry.label;
    const valueWrap = document.createElement('div');
    valueWrap.className = 'd-flex align-items-center gap-2';

    const scoreValue = entry.key === 'overall'
      ? summary.maturity?.overall
      : summary.maturity?.pillars?.[entry.key];
    const scoreEl = document.createElement('div');
    scoreEl.className = 'fs-4 fw-bold';
    scoreEl.textContent = formatScore(scoreValue);

    const deltaValue = entry.key === 'overall'
      ? summary.maturity?.delta?.overall
      : summary.maturity?.delta?.pillars?.[entry.key];
    const deltaEl = document.createElement('span');
    const deltaClass = deltaValue > 0 ? 'text-success' : deltaValue < 0 ? 'text-danger' : 'text-muted';
    deltaEl.className = `badge-soft ${deltaClass}`;
    deltaEl.textContent = formatDelta(deltaValue);

    valueWrap.appendChild(scoreEl);
    valueWrap.appendChild(deltaEl);

    labelWrap.appendChild(label);
    labelWrap.appendChild(valueWrap);

    const sparklineWrap = document.createElement('div');
    const series = entry.key === 'overall'
      ? summary.sparklines?.overall || []
      : summary.sparklines?.pillars?.[entry.key] || [];
    const svg = createSparklineSvg(series);
    if (svg) sparklineWrap.appendChild(svg);

    header.appendChild(labelWrap);
    header.appendChild(sparklineWrap);
    card.appendChild(header);
    col.appendChild(card);
    analyticsMaturityRow.appendChild(col);
  });
}

function renderBusinessAnalytics(summary) {
  if (!analyticsBusinessRow) return;
  analyticsBusinessRow.innerHTML = '';
  const arrSeries = Array.isArray(summary.business?.arr) ? summary.business.arr.slice().sort((a, b) => a.year - b.year) : [];
  const headcountSeries = Array.isArray(summary.business?.headcount)
    ? summary.business.headcount.slice().sort((a, b) => a.year - b.year)
    : [];

  const arrTile = document.createElement('div');
  arrTile.className = 'col-md';
  arrTile.appendChild(buildBusinessTile({
    label: 'ARR',
    value: arrSeries.length ? formatCurrency(arrSeries[arrSeries.length - 1].value) : '--',
    yoy: formatPercent(computeYoYPercent(arrSeries)),
    series: arrSeries
  }));
  analyticsBusinessRow.appendChild(arrTile);

  const headcountTile = document.createElement('div');
  headcountTile.className = 'col-md';
  headcountTile.appendChild(buildBusinessTile({
    label: 'Headcount',
    value: headcountSeries.length ? formatNumber(headcountSeries[headcountSeries.length - 1].value) : '--',
    yoy: formatPercent(computeYoYPercent(headcountSeries)),
    series: headcountSeries
  }));
  analyticsBusinessRow.appendChild(headcountTile);

  const ratioTile = document.createElement('div');
  ratioTile.className = 'col-md';
  const arrPerEmployee = computeArrPerEmployee(arrSeries, headcountSeries);
  ratioTile.appendChild(buildBusinessTile({
    label: 'ARR / Employee',
    value: formatCurrency(arrPerEmployee || NaN),
    yoy: headcountSeries.length && arrSeries.length ? formatPercent(computeYoYPercent(arrSeries)) : '--',
    series: arrSeries
  }));
  analyticsBusinessRow.appendChild(ratioTile);
}

function renderDriverAnalytics(changeAttribution = []) {
  if (!analyticsDriversRow) return;
  analyticsDriversRow.innerHTML = '';
  if (!changeAttribution.length) {
    const empty = document.createElement('div');
    empty.className = 'text-fg-3 small';
    empty.textContent = 'No initiative attributions for the latest change window yet.';
    analyticsDriversRow.appendChild(empty);
    return;
  }
  changeAttribution.forEach(entry => {
    if (!Array.isArray(entry.initiatives) || !entry.initiatives.length) {
      const chip = document.createElement('span');
      chip.className = 'badge-soft text-muted';
      chip.textContent = `${formatDelta(entry.delta)} ${entry.pillar}`;
      analyticsDriversRow.appendChild(chip);
      return;
    }
    entry.initiatives.forEach(initiative => {
      const chip = document.createElement('span');
      const directionClass = initiative.direction >= 0 ? 'text-success' : 'text-danger';
      chip.className = `badge-soft ${directionClass}`;
      const deltaText = formatDelta(entry.delta);
      chip.textContent = `${deltaText} ${entry.pillar} · ${initiative.title}`;
      const dateRange = formatDateRange(initiative.startDate, initiative.endDate);
      chip.title = dateRange ? `${initiative.title} (${dateRange})` : initiative.title;
      analyticsDriversRow.appendChild(chip);
    });
  });
}

function renderAnalyticsSummary(summary) {
  if (!summary) {
    showAnalyticsMessage('Run an assessment to unlock analytics trends.');
    return;
  }
  const hasMaturityHistory = Array.isArray(summary.sparklines?.overall) && summary.sparklines.overall.length > 0;
  if (!hasMaturityHistory) {
    showAnalyticsMessage('Run an assessment to unlock analytics trends.');
    return;
  }
  revealAnalyticsContent();
  renderMaturityAnalytics(summary);
  renderBusinessAnalytics(summary);
  renderDriverAnalytics(summary.changeAttribution || []);
}

function renderTileOptions(groupEl, options = []) {
  if (!groupEl) return;
  groupEl.innerHTML = '';
  options.forEach(option => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `tile-option${option.multiple ? ' multiple' : ''}`;
    btn.dataset.value = option.value;
    if (option.disabled) btn.dataset.disabled = 'true';
    btn.innerHTML = `
      <span>${option.label}</span>
      ${option.hint ? `<span class="tile-hint">${option.hint}</span>` : ''}`;
    groupEl.appendChild(btn);
  });
}

function initTileGroup(groupEl, { multiple = false, values = [], onChange } = {}) {
  if (!groupEl) return null;
  let selected = new Set(Array.isArray(values) ? values : [values].filter(Boolean));

  const commit = () => {
    groupEl.querySelectorAll('.tile-option').forEach(btn => {
      const value = btn.dataset.value;
      btn.classList.toggle('selected', value && selected.has(value));
    });
    onChange?.(Array.from(selected));
  };

  groupEl.addEventListener('click', (event) => {
    const button = event.target.closest('.tile-option');
    if (!button || !groupEl.contains(button) || button.dataset.disabled === 'true') return;
    const value = button.dataset.value;
    if (!value) return;
    if (multiple) {
      if (selected.has(value)) {
        selected.delete(value);
      } else {
        selected.add(value);
      }
    } else {
      selected = new Set([value]);
    }
    commit();
  });

  commit();

  return {
    getValues: () => Array.from(selected),
    setValues: (vals = []) => {
      if (!Array.isArray(vals)) vals = [vals].filter(Boolean);
      selected = new Set(multiple ? vals : vals.slice(0, 1));
      commit();
    },
    clear: () => {
      selected.clear();
      commit();
    }
  };
}

function parseList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value)
    .split(/\n|;|,|·/)
    .map(entry => entry.trim())
    .filter(Boolean);
}

function renderFormTileGroups() {
  if (!form) return;
  if (formCompanySizeTiles) {
    renderTileOptions(formCompanySizeTiles, SIZE_CHOICES);
    formCompanySizeGroup = initTileGroup(formCompanySizeTiles, {
      values: [form.companySize?.value || 'SMB'],
      onChange: (values) => {
        if (form.companySize) form.companySize.value = values[0] || '';
      }
    });
  }
  if (formRegionTiles) {
    renderTileOptions(formRegionTiles, REGION_CHOICES);
    formRegionGroup = initTileGroup(formRegionTiles, {
      values: [form.region?.value || 'EMEA'],
      onChange: (values) => {
        if (form.region) form.region.value = values[0] || '';
      }
    });
  }
  if (formStageTiles) {
    renderTileOptions(formStageTiles, STAGE_CHOICES);
    formStageGroup = initTileGroup(formStageTiles, {
      values: [form.transformationStage?.value || STAGE_CHOICES[1]?.value],
      onChange: (values) => {
        if (form.transformationStage) form.transformationStage.value = values[0] || '';
      }
    });
  }
  if (formRiskTiles) {
    renderTileOptions(formRiskTiles, RISK_CHOICES);
    formRiskGroup = initTileGroup(formRiskTiles, {
      values: [form.riskAppetite?.value || 'Balanced'],
      onChange: (values) => {
        if (form.riskAppetite) form.riskAppetite.value = values[0] || '';
      }
    });
  }
}

function renderProjectTileGroups() {
  if (projectRegionTiles) {
    renderTileOptions(projectRegionTiles, REGION_CHOICES);
    projectRegionGroup = initTileGroup(projectRegionTiles, {
      values: [projectRegionInput?.value || 'EMEA'],
      onChange: (values) => {
        if (projectRegionInput) projectRegionInput.value = values[0] || '';
        updateProjectWizardInsights();
      }
    });
  }
  if (projectSizeTiles) {
    renderTileOptions(projectSizeTiles, SIZE_CHOICES);
    projectSizeGroup = initTileGroup(projectSizeTiles, {
      values: [projectSizeInput?.value || 'SMB'],
      onChange: (values) => {
        if (projectSizeInput) projectSizeInput.value = values[0] || '';
        updateProjectWizardInsights();
      }
    });
  }
  if (projectStageTiles) {
    renderTileOptions(projectStageTiles, STAGE_CHOICES);
    projectStageGroup = initTileGroup(projectStageTiles, {
      values: [projectStageInput?.value || STAGE_CHOICES[1]?.value],
      onChange: (values) => {
        if (projectStageInput) projectStageInput.value = values[0] || '';
        updateProjectWizardInsights();
      }
    });
  }
  if (projectRiskTiles) {
    renderTileOptions(projectRiskTiles, RISK_CHOICES);
    projectRiskGroup = initTileGroup(projectRiskTiles, {
      values: [projectRiskInput?.value || 'Balanced'],
      onChange: (values) => {
        if (projectRiskInput) projectRiskInput.value = values[0] || '';
        updateProjectWizardInsights();
      }
    });
  }

  if (projectCapabilityTiles && catalog) {
    const capabilityOptions = catalog.capabilities.map(cap => ({
      value: cap.id,
      label: cap.name,
      hint: cap.description,
      multiple: true
    }));
    renderTileOptions(projectCapabilityTiles, capabilityOptions);
    projectCapabilityGroup = initTileGroup(projectCapabilityTiles, {
      multiple: true,
      onChange: (values) => {
        projectCapabilitySelection = new Set(values);
        updateProjectWizardInsights();
      }
    });
    projectCapabilitySelection = new Set(projectCapabilityGroup?.getValues() || []);
  }

  if (projectDriverTiles && catalog) {
    const driverOptions = catalog.strategicDrivers.map(driver => ({
      value: driver,
      label: driver,
      hint: '',
      multiple: true
    }));
    renderTileOptions(projectDriverTiles, driverOptions);
    projectDriverGroup = initTileGroup(projectDriverTiles, {
      multiple: true,
      onChange: (values) => {
        projectDriverSelection = new Set(values);
        updateProjectWizardInsights();
      }
    });
    projectDriverSelection = new Set(projectDriverGroup?.getValues() || []);
  }
}

function hasSeenProjectTour() {
  try {
    return localStorage.getItem('agama.projectTourShown') === '1';
  } catch (err) {
    return false;
  }
}

function markProjectTourSeen() {
  try {
    localStorage.setItem('agama.projectTourShown', '1');
  } catch (err) {
    // ignore storage errors
  }
}

function computeProjectInsights({
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
    'Conservative': -6,
    'Balanced': 0,
    'Bold innovation': 8
  };
  const base = stageScores[stage] || 40;
  const risk = riskScores[riskAppetite] || 0;
  const driverContribution = Math.min(strategicDrivers.length * 6, 24);
  const focusContribution = Math.min(capabilityFocus.length * 5, 20);
  const readinessScore = Math.max(35, Math.min(base + risk + driverContribution + focusContribution, 96));

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

  const sentiment = readinessScore >= 80
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

function gatherProjectDraft() {
  const strategicDrivers = Array.from(projectDriverSelection);
  const capabilityFocus = Array.from(projectCapabilitySelection);
  return {
    name: projectNameInput?.value.trim() || '',
    companyDomain: projectDomainInput?.value.trim() || '',
    industry: projectIndustrySelect?.value || '',
    region: projectRegionInput?.value || '',
    companySize: projectSizeInput?.value || '',
    headcount: Number(projectHeadcountInput?.value || 0),
    stage: projectStageInput?.value || '',
    riskAppetite: projectRiskInput?.value || '',
    strategicDrivers,
    capabilityFocus,
    overview: projectNarrativeInput?.value.trim() || '',
    companyProfile: {
      legalName: projectNameInput?.value.trim() || '',
      headcount: Number(projectHeadcountInput?.value || 0),
      annualRevenue: Number(projectRevenueInput?.value || 0),
      strategicBudget: Number(projectBudgetInput?.value || 0),
      executiveObjectives: projectObjectivesInput?.value.trim() || '',
      complianceDrivers: projectComplianceInput?.value.trim() || '',
      narrativeContext: projectNarrativeInput?.value.trim() || '',
      discoveryObjectives: parseList(projectDiscoveryInput?.value || '')
    },
    operatingModel: {
      governanceRhythms: projectGovernanceInput?.value.trim() || '',
      changeManagement: '',
      processNotes: ''
    },
    personas: parseList(projectPersonasInput?.value || '')
  };
}

function updateProjectWizardInsights() {
  const draft = gatherProjectDraft();
  const analytics = computeProjectInsights(draft);
  if (projectReadinessScore) {
    projectReadinessScore.textContent = analytics.readinessScore ? Math.round(analytics.readinessScore) : '--';
  }
  if (projectClarityScore) {
    projectClarityScore.textContent = analytics.clarityScore ? Math.round(analytics.clarityScore) : '--';
  }
  if (projectSentiment) {
    projectSentiment.textContent = analytics.sentiment || 'Complete the steps to preview analytics.';
  }
  if (projectFoundationInsight) {
    const p = projectFoundationInsight.querySelector('p');
    if (p) {
      if (draft.industry && draft.region) {
        p.textContent = `Benchmarking ${draft.industry} peers across ${draft.region} operations.`;
      } else if (draft.industry) {
        p.textContent = `Benchmarking ${draft.industry} peers once region is confirmed.`;
      } else {
        p.textContent = 'Set your industry and footprint to tune the benchmark cohort.';
      }
    }
  }
  if (projectStrategyInsight) {
    const p = projectStrategyInsight.querySelector('p');
    if (p) {
      if (draft.stage && draft.riskAppetite) {
        p.textContent = `Stage: ${draft.stage}. Risk profile: ${draft.riskAppetite}. We will calibrate guardrails and pace.`;
      } else {
        p.textContent = 'Capture transformation stage and risk appetite to align the advisory tone.';
      }
    }
  }
  if (projectSummaryInsight) {
    const driverLine = analytics.driverCount ? `${analytics.driverCount} strategic drivers` : 'Define strategic drivers';
    const focusLine = analytics.focusCount ? `${analytics.focusCount} focus domains` : 'Select focus domains';
    const sentimentLine = projectSummaryInsight.querySelector('.project-summary-footnote');
    if (sentimentLine) {
      sentimentLine.textContent = `${driverLine} · ${focusLine}`;
    }
  }
}

function renderProjectProgress() {
  if (!projectWizardProgress) return;
  projectWizardProgress.innerHTML = '';
  projectSections.forEach(section => {
    const chip = document.createElement('div');
    chip.className = 'onboarding-step-chip';
    const step = Number(section.dataset.step);
    if (step === projectWizardStep) chip.classList.add('active');
    const heading = section.querySelector('h4');
    chip.textContent = heading ? heading.textContent : `Step ${step}`;
    projectWizardProgress.appendChild(chip);
  });
}

function showProjectWizardStep(step) {
  if (!projectOverlay) return;
  projectWizardStep = Math.min(Math.max(step, 1), projectSections.length);
  projectSections.forEach(section => {
    const active = Number(section.dataset.step) === projectWizardStep;
    section.classList.toggle('active', active);
  });
  if (projectPrevBtn) projectPrevBtn.disabled = projectWizardStep === 1;
  if (projectNextBtn) {
    projectNextBtn.textContent = projectWizardStep === projectSections.length ? 'Create project' : 'Next';
  }
  renderProjectProgress();
  updateProjectWizardInsights();
}

function openProjectWizard({ startAt = 1 } = {}) {
  if (!projectOverlay) return;
  projectOverlay.classList.remove('hidden');
  projectOverlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  showProjectWizardStep(startAt);
}

function closeProjectWizard(force = false) {
  if (!projectOverlay) return;
  if (!force && !activeProject) return;
  projectOverlay.classList.add('hidden');
  projectOverlay.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function validateProjectStep(step) {
  const draft = gatherProjectDraft();
  if (step === 2) {
    if (!draft.name.trim()) {
      alert('Provide a project or organisation name.');
      projectNameInput?.focus();
      return false;
    }
    if (!draft.industry) {
      alert('Select an industry to calibrate benchmarks.');
      projectIndustrySelect?.focus();
      return false;
    }
    if (!draft.region) {
      alert('Choose a primary region.');
      return false;
    }
    if (!draft.companySize) {
      alert('Select your company size.');
      return false;
    }
  }
  if (step === 3) {
    if (!draft.stage) {
      alert('Select a transformation stage.');
      return false;
    }
    if (!draft.riskAppetite) {
      alert('Select a risk appetite.');
      return false;
    }
    if (projectDriverSelection.size === 0) {
      alert('Choose at least one strategic driver.');
      return false;
    }
  }
  if (step === 4) {
    if (projectCapabilitySelection.size === 0) {
      alert('Select at least one capability domain to focus on.');
      return false;
    }
  }
  return true;
}

  async function createProject() {
    if (projectCreatePending) {
      return;
    }
    const draft = gatherProjectDraft();
    if (!validateProjectStep(projectWizardStep)) return;
    if (!draft.industry || !draft.region || !draft.companySize) {
      alert('Complete the foundation details before creating the project.');
      return;
    }

  const payload = {
    name: draft.name,
    companyDomain: draft.companyDomain,
    industry: draft.industry,
    region: draft.region,
    companySize: draft.companySize,
    headcount: draft.headcount,
    stage: draft.stage,
    riskAppetite: draft.riskAppetite,
    strategicDrivers: draft.strategicDrivers,
    capabilityFocus: draft.capabilityFocus,
    overview: draft.overview,
    companyProfile: draft.companyProfile,
    operatingModel: draft.operatingModel,
    personas: draft.personas,
    techLandscape: { priorityFocus: draft.capabilityFocus }
  };

    projectCreatePending = true;
    projectNextBtn.disabled = true;
    projectNextBtn.textContent = 'Creating...';

  try {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) {
      throw new Error(json.error || 'Unable to create project');
    }
    const project = json.project;
    projects = [project, ...projects.filter(p => p.id !== project.id)];
    renderProjectOptions();
    setActiveProject(project);
    markProjectTourSeen();
    closeProjectWizard(true);
    engagePulseSpotlight('Project workspace ready — select a tier to dive deeper.', 3600);
  } catch (err) {
    console.error(err);
    alert(err.message || 'Unable to create project.');
    } finally {
      projectCreatePending = false;
      projectNextBtn.disabled = false;
      projectNextBtn.textContent = 'Create project';
    }
  }

function handleProjectNext() {
  if (!validateProjectStep(projectWizardStep)) return;
  if (projectWizardStep === projectSections.length) {
    createProject();
  } else {
    showProjectWizardStep(projectWizardStep + 1);
  }
}

function renderProjectOptions() {
  if (!projectSelect) return;
  projectSelect.innerHTML = '';
  if (!projects.length) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'Create your first project to begin';
    projectSelect.appendChild(opt);
    projectSelect.disabled = true;
    return;
  }
  projectSelect.disabled = false;
  projects.forEach(project => {
    const opt = document.createElement('option');
    opt.value = project.id;
    opt.textContent = project.name;
    projectSelect.appendChild(opt);
  });
  if (activeProject) {
    projectSelect.value = activeProject.id;
  }
}

function updateProjectAnalyticsPreview(project) {
  if (!projectAnalyticsPreview) return;
  if (!project) {
    projectAnalyticsPreview.innerHTML = '<div class="text-fg-3">Create a project to unlock readiness analytics.</div>';
    return;
  }
  const analytics = project.analytics || {};
  const readiness = analytics.readinessScore ? Math.round(analytics.readinessScore) : '--';
  const clarity = analytics.clarityScore ? Math.round(analytics.clarityScore) : '--';
  const driverNote = analytics.driverCount !== undefined ? `${analytics.driverCount} strategic drivers` : `${(project.strategicDrivers || []).length} strategic drivers`;
  const focusNote = analytics.focusCount !== undefined ? `${analytics.focusCount} focus domains` : `${(project.capabilityFocus || []).length} focus domains`;
  projectAnalyticsPreview.innerHTML = `
    <div class="project-analytics__tile">
      <span class="project-analytics__label">Readiness</span>
      <div class="project-analytics__value">${readiness}</div>
      <p class="project-analytics__note">${analytics.sentiment || 'Complete more detail to see readiness signals.'}</p>
    </div>
    <div class="project-analytics__tile">
      <span class="project-analytics__label">Clarity</span>
      <div class="project-analytics__value">${clarity}</div>
      <p class="project-analytics__note">Context depth from executive objectives & governance.</p>
    </div>
    <div class="project-analytics__tile">
      <span class="project-analytics__label">Coverage</span>
      <div class="project-analytics__value">${driverNote}</div>
      <p class="project-analytics__note">${focusNote}</p>
    </div>`;
}

async function loadProjectAnalytics(project) {
  if (!analyticsPanel) return;
  if (!project) {
    showAnalyticsMessage('Select a project to load analytics.');
    return;
  }
  try {
    if (analyticsAbortController) {
      analyticsAbortController.abort();
    }
    analyticsAbortController = new AbortController();
    showAnalyticsMessage('Loading analytics…');
    const res = await fetch(`/api/projects/${project.id}/analytics/summary`, {
      credentials: 'include',
      signal: analyticsAbortController.signal
    });
    if (res.status === 401) {
      showAnalyticsMessage('Please sign in again to view analytics.');
      analyticsAbortController = null;
      return;
    }
    if (!res.ok) throw new Error('Unable to load analytics');
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Unable to load analytics');
    renderAnalyticsSummary(json);
    analyticsAbortController = null;
  } catch (err) {
    if (err.name === 'AbortError') return;
    console.error(err);
    showAnalyticsMessage('Analytics unavailable right now. Please try again soon.');
  }
}

function applyProjectContext(project) {
  if (!form || !project) return;
  if (form.companyName) form.companyName.value = project.companyProfile?.legalName || project.name || '';
  if (form.headcount) form.headcount.value = project.companyProfile?.headcount || project.headcount || '';
  if (form.annualRevenue) form.annualRevenue.value = project.companyProfile?.annualRevenue || '';
  if (form.strategicBudget) form.strategicBudget.value = project.companyProfile?.strategicBudget || '';
  if (form.executiveObjectives) form.executiveObjectives.value = Array.isArray(project.companyProfile?.executiveObjectives)
    ? project.companyProfile.executiveObjectives.join('\n')
    : (project.companyProfile?.executiveObjectives || '');
  if (form.narrativeContext) form.narrativeContext.value = project.companyProfile?.narrativeContext || '';
  if (form.governanceRhythms) form.governanceRhythms.value = project.operatingModel?.governanceRhythms || '';
  if (form.changeManagement) form.changeManagement.value = project.operatingModel?.changeManagement || '';
  if (form.teamObjectives) form.teamObjectives.value = project.operatingModel?.teamObjectives || '';
  if (form.dataPractices) form.dataPractices.value = project.operatingModel?.dataPractices || '';
  if (form.vendorNotes) form.vendorNotes.value = project.vendorStrategy?.notes || '';
  if (form.vendorQuestions) form.vendorQuestions.value = project.vendorStrategy?.questions || '';

  if (industrySelect && project.industry) industrySelect.value = project.industry;
  formCompanySizeGroup?.setValues([project.companySize || 'SMB']);
  formRegionGroup?.setValues([project.region || 'EMEA']);
  formStageGroup?.setValues([project.companyProfile?.transformationStage || project.stage || STAGE_CHOICES[1]?.value]);
  formRiskGroup?.setValues([project.companyProfile?.riskAppetite || project.riskAppetite || 'Balanced']);
  strategicDriverGroup?.setValues(project.strategicDrivers || []);
  strategicDriverSelection = new Set(strategicDriverGroup?.getValues() || []);

    const focusDomains = new Set();
    if (Array.isArray(project.capabilityFocus)) {
      project.capabilityFocus.forEach(entry => {
        if (!entry) return;
        if (!catalog) {
          focusDomains.add(String(entry));
          return;
        }
        const byId = catalog.capabilities.find(cap => cap.id === entry);
        if (byId) {
          byId.domains.forEach(domain => focusDomains.add(domain));
          return;
        }
        const domainMatch = catalog.capabilities.some(cap => cap.domains.includes(entry));
        if (domainMatch) {
          focusDomains.add(entry);
          return;
        }
        focusDomains.add(String(entry));
      });
    }
    if (capabilityFocusSelect) {
      const hasResolvedDomains = focusDomains.size > 0;
      Array.from(capabilityFocusSelect.options).forEach(opt => {
        if (hasResolvedDomains) {
          opt.selected = focusDomains.has(opt.value);
        } else {
          opt.selected = Array.isArray(project.capabilityFocus) ? project.capabilityFocus.includes(opt.value) : false;
        }
      });
    }

  if (projectIndustrySelect) projectIndustrySelect.value = project.industry || '';
  if (projectRegionInput) projectRegionInput.value = project.region || 'EMEA';
  if (projectSizeInput) projectSizeInput.value = project.companySize || 'SMB';
  if (projectStageInput) projectStageInput.value = project.stage || STAGE_CHOICES[1]?.value || '';
  if (projectRiskInput) projectRiskInput.value = project.riskAppetite || 'Balanced';
  projectRegionGroup?.setValues([project.region || 'EMEA']);
  projectSizeGroup?.setValues([project.companySize || 'SMB']);
  projectStageGroup?.setValues([project.stage || STAGE_CHOICES[1]?.value]);
  projectRiskGroup?.setValues([project.riskAppetite || 'Balanced']);
  const capabilityIds = Array.isArray(project.capabilityFocus)
    ? Array.from(new Set(project.capabilityFocus.map(entry => {
        if (!catalog) return entry;
        const byId = catalog.capabilities.find(cap => cap.id === entry);
        if (byId) return byId.id;
        const byDomain = catalog.capabilities.find(cap => cap.domains.includes(entry));
        return byDomain ? byDomain.id : entry;
      })))
    : [];
  projectCapabilityGroup?.setValues(capabilityIds);
  projectCapabilitySelection = new Set(projectCapabilityGroup?.getValues() || []);
  projectDriverGroup?.setValues(project.strategicDrivers || []);
  projectDriverSelection = new Set(projectDriverGroup?.getValues() || []);

  if (projectNameInput) projectNameInput.value = project.name || '';
  if (projectDomainInput) projectDomainInput.value = project.companyDomain || '';
  if (projectHeadcountInput) projectHeadcountInput.value = project.companyProfile?.headcount || project.headcount || '';
  if (projectRevenueInput) projectRevenueInput.value = project.companyProfile?.annualRevenue || '';
  if (projectBudgetInput) projectBudgetInput.value = project.companyProfile?.strategicBudget || '';
  if (projectObjectivesInput) projectObjectivesInput.value = Array.isArray(project.companyProfile?.executiveObjectives)
    ? project.companyProfile.executiveObjectives.join('\n')
    : (project.companyProfile?.executiveObjectives || '');
  if (projectComplianceInput) projectComplianceInput.value = project.companyProfile?.complianceDrivers || '';
  if (projectNarrativeInput) projectNarrativeInput.value = project.companyProfile?.narrativeContext || '';
  if (projectGovernanceInput) projectGovernanceInput.value = project.operatingModel?.governanceRhythms || '';
  if (projectDiscoveryInput) {
    let discovery = project.companyProfile?.discoveryObjectives;
    if (!Array.isArray(discovery) && Array.isArray(project.operatingModel?.discoveryObjectives)) {
      discovery = project.operatingModel.discoveryObjectives;
    }
    projectDiscoveryInput.value = Array.isArray(discovery) ? discovery.join('\n') : (discovery || '');
  }
  if (projectPersonasInput) {
    const rawPersonas = project.personas;
    const personasList = Array.isArray(rawPersonas)
      ? rawPersonas
          .map(persona => {
            if (!persona) return '';
            if (typeof persona === 'string') return persona;
            return persona.title || persona.name || '';
          })
          .filter(Boolean)
      : [];
    projectPersonasInput.value = personasList.join(' · ');
  }

  updateProjectWizardInsights();
}

function setActiveProject(projectOrId) {
  let project = projectOrId;
  if (!project && typeof projectOrId === 'string') {
    project = projects.find(p => p.id === projectOrId);
  }
  if (!project || typeof project === 'string') {
    activeProject = null;
    updateProjectAnalyticsPreview(null);
    showAnalyticsMessage('Select a project to load analytics.');
    return;
  }
  activeProject = project;
  if (projectSelect) {
    projectSelect.value = project.id;
  }
  updateProjectAnalyticsPreview(project);
  applyProjectContext(project);
  loadProjectAnalytics(project);
}

async function loadProjects() {
  try {
    const res = await fetch('/api/projects', { credentials: 'include' });
    if (!res.ok) throw new Error('Unable to fetch projects');
    const json = await res.json();
    if (json.entitlement) applyEntitlement(json.entitlement);
    projects = Array.isArray(json.projects) ? json.projects : [];
  } catch (err) {
    console.error(err);
    projects = [];
  }
  renderProjectOptions();
  if (projects.length) {
    const params = new URLSearchParams(location.search);
    const requestedProjectId = params.get('projectId');
    let initialProject = null;
    if (requestedProjectId) {
      initialProject = projects.find(p => p.id === requestedProjectId) || null;
    }
    if (!initialProject) {
      initialProject = projects[0];
    }
    setActiveProject(initialProject);
    if (requestedProjectId && initialProject && typeof history.replaceState === 'function') {
      params.delete('projectId');
      const nextSearch = params.toString();
      const newUrl = `${location.pathname}${nextSearch ? `?${nextSearch}` : ''}${location.hash}`;
      history.replaceState({}, '', newUrl);
    }
    if (!hasSeenProjectTour()) {
      openProjectWizard({ startAt: 1 });
    }
  } else {
    setActiveProject(null);
    openProjectWizard({ startAt: 1 });
  }
}

const STEP_LABELS = {
  1: 'Focus',
  2: 'Company',
  3: 'Teams',
  4: 'Technology',
  5: 'Maturity',
  6: 'Blueprint'
};

const STAGE_CONFIG = {
  insight: {
    label: 'Insight Pulse',
    price: 'Free',
    spotlight: 'Insight Pulse (Free): Rapid executive preview with AI-tailored quick wins.',
    steps: [1, 2, 3, 4, 5],
    messages: {
      1: 'Frame the transformation thesis to unlock the executive preview.',
      2: 'Clarify personas so we tailor playbooks to stakeholder goals.',
      3: 'Describe teams and rhythms to align operating guidance.',
      4: 'Document current tooling to calibrate baseline recommendations.',
      5: 'Score each pillar to generate your maturity radar and narrative.'
    }
  },
  strategic: {
    label: 'Industry Accelerator',
    price: '$250',
    spotlight: 'Industry Accelerator ($250): Unlock industry heatmaps, investment cases, and vendor interrogations.',
    steps: [1, 2, 3, 4, 5],
    messages: {
      1: 'Anchor the accelerator to board objectives and analyst benchmarks.',
      2: 'Capture financials and persona metrics to shape value cases.',
      3: 'Explain data and process maturity for the industry heatmap.',
      4: 'Share investments to craft vendor strategy interrogations.',
      5: 'Extended pillars unlock regulatory cues and value modelling.'
    }
  },
  command: {
    label: 'Command Blueprint',
    price: '$2,500',
    spotlight: 'Command Blueprint ($2,500): Boardroom blueprint with architecture, vendor orchestration, and delivery guardrails.',
    steps: [1, 2, 3, 4, 5, 6],
    messages: {
      1: 'Define strategic ambition to trigger the boardroom advisory engine.',
      2: 'Map personas and budgets so we choreograph leadership guardrails.',
      3: 'Expose operating cadences to shape change governance.',
      4: 'Detail architecture and vendors to orchestrate negotiation playbooks.',
      5: 'Advanced scoring fuels risk sensing and industry heatmaps.',
      6: 'Upload artefacts and initiatives to craft the delivery command deck.'
    }
  }
};

const EXTENDED_PILLARS = new Set([
  'Vendor Strategy & Ecosystem',
  'Data, People & Process',
  'Investment & Value Management'
]);

const COMMAND_PILLARS = new Set([
  'Architecture & Resilience',
  'Vendor Execution & Assurance',
  'Change Leadership & Adoption'
]);

let catalog;
let currentStage;
let currentStep = 1;
let selectedCapability;
let personaBlueprint = [];
let questionnaireLoadedStage = null;
let architectureFiles = [];
let pulseTimeout = null;
let pulseLocked = false;
let me = null;
let projects = [];
let activeProject = null;
let projectWizardStep = 1;
let strategicDriverSelection = new Set();
let selectedPersonaIds = new Set();
let projectCapabilitySelection = new Set();
let projectDriverSelection = new Set();
let analyticsAbortController = null;

let strategicDriverGroup;
let personaGroup;
let formCompanySizeGroup;
let formRegionGroup;
let formStageGroup;
let formRiskGroup;
let projectRegionGroup;
let projectSizeGroup;
let projectStageGroup;
let projectRiskGroup;
let projectCapabilityGroup;
let projectDriverGroup;
let projectCreatePending = false;

const REGION_CHOICES = [
  { value: 'EMEA', label: 'EMEA', hint: 'Europe, Middle East & Africa' },
  { value: 'AMER', label: 'AMER', hint: 'North & South America' },
  { value: 'APAC', label: 'APAC', hint: 'Asia Pacific' },
  { value: 'Global', label: 'Global footprint', hint: 'Distributed / multi-region' }
];

const SIZE_CHOICES = [
  { value: 'SMB', label: 'SMB', hint: '1-499 people' },
  { value: 'Mid-market', label: 'Mid-market', hint: '500-4,999 people' },
  { value: 'Enterprise', label: 'Enterprise', hint: '5,000+ people' }
];

const STAGE_CHOICES = [
  { value: 'Discovery & Fit', label: 'Discovery & Fit', hint: 'Framing opportunities and early pilots' },
  { value: 'Mobilising programme', label: 'Mobilising programme', hint: 'Funding approved, squads forming' },
  { value: 'Scaling transformation', label: 'Scaling transformation', hint: 'Multi-stream delivery underway' },
  { value: 'Optimising value', label: 'Optimising value', hint: 'Refining ROI and embedding guardrails' }
];

const RISK_CHOICES = [
  { value: 'Conservative', label: 'Conservative', hint: 'Guardrail-first, low experimentation' },
  { value: 'Balanced', label: 'Balanced', hint: 'Managed experimentation with governance' },
  { value: 'Bold innovation', label: 'Bold innovation', hint: 'Aggressive bets and rapid iteration' }
];

function setValuePulse(message, { force = false, highlight = false } = {}) {
  if (!valuePulse) return;
  if (pulseLocked && !force) return;
  valuePulse.textContent = message;
  if (highlight) {
    valuePulse.classList.add('value-pulse--highlight');
  } else if (!pulseLocked) {
    valuePulse.classList.remove('value-pulse--highlight');
  }
}

function updateValuePulse(step = currentStep) {
  if (!currentStage) {
    setValuePulse('Select a tier to begin.', { force: true });
    return;
  }
  if (pulseLocked) return;
  const config = STAGE_CONFIG[currentStage];
  const msg = config?.messages?.[step];
  setValuePulse(msg || config?.messages?.[config.steps[0]] || 'Provide detail to personalise the advisory output.', { force: true });
}

function engagePulseSpotlight(message, duration = 3400) {
  if (!valuePulse || !message) return;
  if (pulseTimeout) {
    clearTimeout(pulseTimeout);
    pulseTimeout = null;
  }
  pulseLocked = true;
  setValuePulse(message, { force: true, highlight: true });
  pulseTimeout = setTimeout(() => {
    pulseLocked = false;
    valuePulse.classList.remove('value-pulse--highlight');
    updateValuePulse(currentStep);
    pulseTimeout = null;
  }, duration);
}

function renderSteps() {
  stepContainer.innerHTML = '';
  const config = STAGE_CONFIG[currentStage];
  if (!config) return;
  config.steps.forEach(step => {
    const pill = document.createElement('div');
    pill.className = 'step-chip';
    pill.dataset.step = step;
    pill.textContent = STEP_LABELS[step];
    stepContainer.appendChild(pill);
  });
}

function updateProgress() {
  const config = STAGE_CONFIG[currentStage];
  if (!config) return;
  const idx = config.steps.indexOf(currentStep);
  const pct = ((idx + 1) / config.steps.length) * 100;
  progressBar.style.width = `${pct}%`;
  stepContainer.querySelectorAll('.step-chip').forEach(chip => {
    const step = Number(chip.dataset.step);
    chip.classList.toggle('active', step === currentStep);
    chip.classList.toggle('complete', config.steps.indexOf(step) < idx);
  });
  prevBtn.disabled = idx === 0;
  const isLast = idx === config.steps.length - 1;
  nextBtn.classList.toggle('d-none', isLast);
  submitBtn.classList.toggle('d-none', !isLast);
  updateValuePulse(currentStep);
}

function showStep(step) {
  currentStep = step;
  sections.forEach(section => {
    const sectionStep = Number(section.dataset.step);
    const tierRestriction = section.dataset.tier;
    const allowed = !tierRestriction || currentStage === tierRestriction;
    section.classList.toggle('d-none', sectionStep !== step || !allowed);
    if (sectionStep === step && allowed) {
      section.classList.add('animate-section');
      setTimeout(() => section.classList.remove('animate-section'), 450);
    }
  });
  updateProgress();
}

function selectStage(stage) {
  if (currentStage === stage) return;
  currentStage = stage;
  tierCards.forEach(card => card.classList.toggle('selected', card.dataset.stage === stage));
  form.classList.remove('d-none');
  renderSteps();
  questionnaireLoadedStage = null;
  showStep(STAGE_CONFIG[stage].steps[0]);
  engagePulseSpotlight(STAGE_CONFIG[stage].spotlight);
  if (stage === 'command' && timelineList.childElementCount === 0) {
    addTimelineEntry();
  }
}

tierCards.forEach(card => {
  card.addEventListener('click', () => {
    if (!activeProject) {
      engagePulseSpotlight('Create a project workspace to unlock assessments.', 3200);
      openProjectWizard({ startAt: 1 });
      return;
    }
    selectStage(card.dataset.stage);
  });
});

function renderCapabilities() {
  capabilityOptions.innerHTML = '';
  catalog.capabilities.forEach(cap => {
    const col = document.createElement('div');
    col.className = 'col-md-6';
    col.innerHTML = `
      <label class="capability-card" data-id="${cap.id}">
        <input type="radio" name="assessmentType" value="${cap.id}">
        <div class="d-flex flex-column gap-2">
          <div>
            <h5 class="m-0">${cap.name}</h5>
            <p class="text-fg-3 small mb-0">${cap.description}</p>
          </div>
          <div class="small text-fg-3">Focus domains: ${cap.domains.join(', ')}</div>
        </div>
      </label>`;
    capabilityOptions.appendChild(col);
  });

  capabilityOptions.addEventListener('change', (e) => {
    if (e.target.name === 'assessmentType') {
      selectedCapability = catalog.capabilities.find(cap => cap.id === e.target.value);
      updateCapabilitySelection();
      updateValuePulse();
    }
  });
}

function renderStrategicDrivers() {
  strategicDriversWrap.innerHTML = '';
  const options = catalog.strategicDrivers.map(driver => ({
    value: driver,
    label: driver,
    hint: ''
  }));
  renderTileOptions(strategicDriversWrap, options.map(option => ({ ...option, multiple: true })));
  strategicDriverGroup = initTileGroup(strategicDriversWrap, {
    multiple: true,
    onChange: (values) => {
      strategicDriverSelection = new Set(values);
    }
  });
  strategicDriverSelection = new Set(strategicDriverGroup?.getValues() || []);
}

function renderIndustries() {
  if (industrySelect) {
    industrySelect.innerHTML = '<option value="">Select industry</option>';
  }
  if (projectIndustrySelect) {
    projectIndustrySelect.innerHTML = '<option value="">Select industry</option>';
  }
  catalog.industries.forEach(ind => {
    if (industrySelect) {
      const opt = document.createElement('option');
      opt.value = ind;
      opt.textContent = ind;
      industrySelect.appendChild(opt);
    }
    if (projectIndustrySelect) {
      const optProj = document.createElement('option');
      optProj.value = ind;
      optProj.textContent = ind;
      projectIndustrySelect.appendChild(optProj);
    }
  });
}

function renderOrganisations() {
  catalog.organisations.forEach(org => {
    const opt = document.createElement('option');
    opt.value = org;
    opt.textContent = org;
    orgSelect.appendChild(opt);
  });
}

function renderCapabilityFocusOptions() {
  capabilityFocusSelect.innerHTML = '';
  const uniqueDomains = new Set();
  catalog.capabilities.forEach(cap => cap.domains.forEach(d => uniqueDomains.add(d)));
  uniqueDomains.forEach(domain => {
    const opt = document.createElement('option');
    opt.value = domain;
    opt.textContent = domain;
    capabilityFocusSelect.appendChild(opt);
  });
}

function updateCapabilitySelection() {
  document.querySelectorAll('.capability-card').forEach(card => {
    card.classList.toggle('selected', card.dataset.id === selectedCapability.id);
  });
  personaBlueprint = selectedCapability.personas;
  renderPersonas();
  renderTechLandscape();
  Array.from(capabilityFocusSelect.options).forEach(opt => {
    opt.selected = selectedCapability.domains.includes(opt.value);
  });
}

function renderPersonas() {
  personaWrap.innerHTML = '';
  personaBlueprint.forEach(persona => {
    const col = document.createElement('div');
    col.className = 'col-md-6';
    col.innerHTML = `
      <button type="button" class="tile-option multiple" data-value="${persona.id}">
        <div class="d-flex flex-column gap-1 text-start">
          <span class="fw-semibold">${persona.title}</span>
          <span class="tile-hint">Outcomes: ${persona.outcomes.join(', ')}</span>
        </div>
      </button>`;
    personaWrap.appendChild(col);
  });
  personaGroup = initTileGroup(personaWrap, {
    multiple: true,
    values: personaBlueprint.map(p => p.id),
    onChange: (values) => {
      selectedPersonaIds = new Set(values);
    }
  });
  selectedPersonaIds = new Set(personaGroup?.getValues() || []);
}

function renderTechLandscape() {
  techLandscapeWrap.innerHTML = '';
  selectedCapability.technologyLandscape.forEach(item => {
    const col = document.createElement('div');
    col.className = 'col-md-6';
    col.innerHTML = `
      <div class="tech-tile h-100">
        <label for="tech-${item.id}">${item.label}</label>
        <textarea id="tech-${item.id}" class="form-control" rows="3" data-tech="${item.id}" placeholder="${item.placeholder}"></textarea>
      </div>`;
    techLandscapeWrap.appendChild(col);
  });
}

async function loadQuestionnaire(stage) {
  questionnaireWrap.innerHTML = '<div class="loading-state">Loading maturity questionnaire...</div>';
  const res = await fetch(`/api/assessments/questions?stage=${stage}`);
  if (!res.ok) {
    questionnaireWrap.innerHTML = '<div class="text-danger">Unable to load questionnaire.</div>';
    return;
  }
  const json = await res.json();
  questionnaireWrap.innerHTML = '';
  Object.entries(json.questions).forEach(([pillar, items]) => {
    const section = document.createElement('div');
    section.className = 'question-pillar';
    section.dataset.pillar = pillar;
    section.innerHTML = `<h5>${pillar}<span class="badge-pill">0-5 scale</span></h5>`;
    items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'question-item';
      row.innerHTML = `
        <label for="${pillar}-${item.id}">${item.text}</label>
        <div class="range-wrap">
          <input type="range" class="form-range" id="${pillar}-${item.id}" data-pillar="${pillar}" data-question="${item.id}" min="0" max="5" step="1" value="3">
          <span class="range-value">3</span>
        </div>`;
      section.appendChild(row);
    });
    questionnaireWrap.appendChild(section);
  });
  questionnaireWrap.querySelectorAll('.form-range').forEach(range => {
    range.addEventListener('input', (e) => {
      e.target.nextElementSibling.textContent = e.target.value;
    });
    range.addEventListener('change', () => updateValuePulse(5));
  });
  questionnaireLoadedStage = stage;
}

function validateStep(step) {
  if (step === 1) {
    if (!selectedCapability) {
      alert('Select a primary capability focus.');
      return false;
    }
    if (!industrySelect.value) {
      alert('Select your industry.');
      return false;
    }
    if (strategicDriverSelection.size === 0) {
      alert('Choose at least one strategic driver.');
      return false;
    }
  }
  if (step === 2) {
    const requiredFields = sections.find(sec => Number(sec.dataset.step) === 2).querySelectorAll('input[required], select[required]');
    for (const field of requiredFields) {
      if (!field.reportValidity()) {
        return false;
      }
    }
    if (selectedPersonaIds.size === 0) {
      alert('Select at least one persona to tailor the insights.');
      return false;
    }
  }
  if (step === 5 && questionnaireLoadedStage !== currentStage) {
    alert('Questionnaire failed to load. Please retry.');
    return false;
  }
  return true;
}

nextBtn.addEventListener('click', async () => {
  if (!currentStage) {
    alert('Select a report tier to continue.');
    return;
  }
  const config = STAGE_CONFIG[currentStage];
  if (!validateStep(currentStep)) return;
  const idx = config.steps.indexOf(currentStep);
  const nextStep = config.steps[Math.min(idx + 1, config.steps.length - 1)];
  if (nextStep === currentStep) return;
  if (nextStep === 5 && questionnaireLoadedStage !== currentStage) {
    await loadQuestionnaire(currentStage);
  }
  showStep(nextStep);
});

prevBtn.addEventListener('click', () => {
  if (!currentStage) return;
  const config = STAGE_CONFIG[currentStage];
  const idx = config.steps.indexOf(currentStep);
  const prevStep = config.steps[Math.max(idx - 1, 0)];
  showStep(prevStep);
});

form.addEventListener('focusin', (event) => {
  const tip = event.target?.dataset?.tip;
  if (tip) {
    if (pulseTimeout) {
      clearTimeout(pulseTimeout);
      pulseTimeout = null;
    }
    pulseLocked = false;
    valuePulse.classList.remove('value-pulse--highlight');
    setValuePulse(tip, { force: true });
  }
});

form.addEventListener('focusout', () => {
  setTimeout(() => updateValuePulse(currentStep), 200);
});

if (architectureInput) {
  architectureInput.addEventListener('change', async (event) => {
    const files = Array.from(event.target.files || []);
    for (const file of files) {
      if (architectureFiles.length >= 5) break;
      if (file.size > 2 * 1024 * 1024) {
        alert(`${file.name} exceeds the 2MB limit.`);
        continue;
      }
      const data = await readFileAsDataURL(file);
      architectureFiles.push({ filename: file.name, mimeType: file.type, data });
    }
    renderArchitecturePreview();
    architectureInput.value = '';
  });
}

function renderArchitecturePreview() {
  if (!architecturePreview) return;
  architecturePreview.innerHTML = '';
  architectureFiles.forEach((file, index) => {
    const item = document.createElement('div');
    item.className = 'uploaded-file';
    item.innerHTML = `
      <div>
        <strong>${file.filename}</strong>
        <div class="small text-fg-3">${Math.round((file.data.length * 0.75) / 1024)} KB · ${file.mimeType || 'Unknown type'}</div>
      </div>
      <button type="button" class="btn btn-sm btn-outline-light" data-remove-architecture="${index}">Remove</button>`;
    architecturePreview.appendChild(item);
  });
  architecturePreview.querySelectorAll('[data-remove-architecture]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.removeArchitecture);
      architectureFiles.splice(idx, 1);
      renderArchitecturePreview();
    });
  });
}

if (projectSelect) {
  projectSelect.addEventListener('change', () => {
    const value = projectSelect.value;
    if (!value) return;
    const project = projects.find(p => p.id === value);
    setActiveProject(project || null);
  });
}

if (launchProjectWizardBtn) {
  launchProjectWizardBtn.addEventListener('click', () => openProjectWizard({ startAt: 1 }));
}

if (replayProjectTourBtn) {
  replayProjectTourBtn.addEventListener('click', () => openProjectWizard({ startAt: 1 }));
}

if (projectCloseBtn) {
  projectCloseBtn.addEventListener('click', () => closeProjectWizard(!!activeProject));
}

if (projectPrevBtn) {
  projectPrevBtn.addEventListener('click', () => showProjectWizardStep(projectWizardStep - 1));
}

if (projectNextBtn) {
  projectNextBtn.addEventListener('click', handleProjectNext);
}

if (projectSkipBtn) {
  projectSkipBtn.addEventListener('click', () => {
    if (projectWizardStep === 1) {
      showProjectWizardStep(2);
    } else if (activeProject) {
      closeProjectWizard(true);
    } else {
      alert('Capture the project foundations to continue.');
    }
  });
}

[
  projectNameInput,
  projectIndustrySelect,
  projectObjectivesInput,
  projectComplianceInput,
  projectNarrativeInput,
  projectGovernanceInput,
  projectDiscoveryInput,
  projectHeadcountInput,
  projectRevenueInput,
  projectBudgetInput,
  projectPersonasInput
].forEach(input => {
  if (!input) return;
  input.addEventListener('input', updateProjectWizardInsights);
  input.addEventListener('change', updateProjectWizardInsights);
});

function addTimelineEntry(preset = {}) {
  if (!timelineList) return;
  const wrapper = document.createElement('div');
  wrapper.className = 'timeline-item';
  wrapper.dataset.initiative = 'true';
  wrapper.innerHTML = `
    <div class="row g-2 align-items-end">
      <div class="col-md-5">
        <label class="form-label">Initiative</label>
        <input type="text" class="form-control" name="initiativeTitle" value="${preset.title || ''}" placeholder="e.g. Splunk to OTEL migration">
      </div>
      <div class="col-md-3">
        <label class="form-label">Owner</label>
        <input type="text" class="form-control" name="initiativeOwner" value="${preset.owner || ''}" placeholder="e.g. Director of SecOps">
      </div>
      <div class="col-md-2">
        <label class="form-label">Timeline</label>
        <input type="text" class="form-control" name="initiativeTimeline" value="${preset.timeline || ''}" placeholder="Q3 FY25">
      </div>
      <div class="col-md-2 text-end">
        <button type="button" class="btn btn-outline-light btn-sm" data-remove-initiative>Remove</button>
      </div>
      <div class="col-12">
        <label class="form-label">Outcome / KPI</label>
        <textarea class="form-control" name="initiativeOutcome" rows="2" placeholder="Measured impact or KPI target">${preset.outcome || ''}</textarea>
      </div>
    </div>`;
  timelineList.appendChild(wrapper);
  wrapper.querySelector('[data-remove-initiative]').addEventListener('click', () => {
    wrapper.remove();
  });
}

if (addInitiativeBtn) {
  addInitiativeBtn.addEventListener('click', () => addTimelineEntry());
}

function gatherTimeline() {
  if (!timelineList) return [];
  return Array.from(timelineList.querySelectorAll('[data-initiative]')).map(item => ({
    title: item.querySelector('[name="initiativeTitle"]').value.trim(),
    owner: item.querySelector('[name="initiativeOwner"]').value.trim(),
    timeline: item.querySelector('[name="initiativeTimeline"]').value.trim(),
    outcome: item.querySelector('[name="initiativeOutcome"]').value.trim(),
    description: item.querySelector('[name="initiativeOutcome"]').value.trim()
  })).filter(entry => entry.title || entry.outcome || entry.timeline);
}

function collectAnswers() {
  const answers = {};
  const extendedAnswers = {};
  const commandAnswers = {};
  questionnaireWrap.querySelectorAll('input[data-pillar]').forEach(input => {
    const pillar = input.dataset.pillar;
    const value = Number(input.value || 0);
    const target = COMMAND_PILLARS.has(pillar)
      ? commandAnswers
      : EXTENDED_PILLARS.has(pillar)
        ? extendedAnswers
        : answers;
    target[pillar] = target[pillar] || {};
    target[pillar][input.dataset.question] = value;
  });
  return { answers, extendedAnswers, commandAnswers };
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const config = STAGE_CONFIG[currentStage];
  if (!validateStep(config.steps[config.steps.length - 1])) return;

  submitBtn.disabled = true;
  submitBtn.textContent = 'Generating...';

  try {
    if (!activeProject) {
      alert('Create a project workspace before generating an assessment.');
      openProjectWizard({ startAt: 1 });
      return;
    }
    const strategicDrivers = Array.from(strategicDriverSelection);
    const capabilityFocus = Array.from(capabilityFocusSelect.selectedOptions).map(opt => opt.value);
    const personas = personaBlueprint.filter(p => selectedPersonaIds.has(p.id));
    const techLandscape = {};
    techLandscapeWrap.querySelectorAll('textarea[data-tech]').forEach(area => {
      techLandscape[area.dataset.tech] = area.value.trim();
    });
    const { answers, extendedAnswers, commandAnswers } = collectAnswers();
    const timeline = gatherTimeline();

    const payload = {
      projectId: activeProject.id,
      stage: currentStage,
      assessmentType: selectedCapability.id,
      companySize: form.companySize.value,
      region: form.region.value,
      industry: form.industry.value,
      strategicDrivers,
      organization: { name: orgSelect.value },
      capabilityFocus,
      techLandscape,
      personas,
      answers,
      extendedAnswers,
      commandAnswers,
      companyProfile: {
        name: form.companyName.value.trim(),
        headcount: Number(form.headcount.value || 0),
        annualRevenue: Number(form.annualRevenue.value || 0),
        transformationStage: form.transformationStage.value,
        riskAppetite: form.riskAppetite.value,
        strategicBudget: Number(form.strategicBudget.value || 0),
        narrativeContext: form.narrativeContext.value.trim(),
        executiveObjectives: form.executiveObjectives.value.trim()
      },
      stakeholderProfile: {
        primaryRole: form.stakeholderRole.value.trim(),
        roleObjectives: form.roleObjectives.value.trim(),
        teamObjectives: form.teamObjectives.value.trim(),
        dataPractices: form.dataPractices.value.trim()
      },
      investmentProfile: {
        currentInvestments: form.currentInvestments.value.trim(),
        vendorNotes: form.vendorNotes.value.trim(),
        vendorAgnostic: form.vendorAgnostic.value,
        vendorQuestions: form.vendorQuestions.value.trim(),
        fundingGuardrails: form.fundingGuardrails ? form.fundingGuardrails.value.trim() : '',
        storytelling: form.storytelling ? form.storytelling.value.trim() : ''
      },
      vendorStrategy: {
        notes: form.vendorNotes.value.trim(),
        vendorAgnostic: form.vendorAgnostic.value,
        questions: form.vendorQuestions.value.trim()
      },
      operatingModel: {
        governanceRhythms: form.governanceRhythms.value.trim(),
        changeManagement: form.changeManagement.value.trim(),
        teamStructure: form.teamStructure ? form.teamStructure.value.trim() : '',
        kpiStack: form.kpiStack ? form.kpiStack.value.trim() : '',
        processPainPoints: form.processPainPoints ? form.processPainPoints.value.trim() : ''
      },
      initiativeTimeline: timeline,
      architectureUploads: architectureFiles,
      architectureSignals: {
        telemetryStandards: form.telemetryStandards ? form.telemetryStandards.value.trim() : '',
        securityWatchlist: form.securityWatchlist ? form.securityWatchlist.value.trim() : '',
        outageNarratives: form.outageNarratives ? form.outageNarratives.value.trim() : ''
      }
    };

    const res = await fetch('/api/assessments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });

    if (res.status === 401) {
      alert('Please sign in to save your assessment.');
      location.href = '/login.html';
      return;
    }

    const json = await res.json();
    if (!json.ok) {
      alert(json.error || 'Unable to generate report.');
      return;
    }

    location.href = `/report.html?id=${json.reportId}`;
  } catch (err) {
    console.error(err);
    alert('Unexpected error generating assessment.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Generate my report';
  }
});

async function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function init() {
  try {
    const authRes = await fetch('/api/auth/me', { credentials: 'include' });
    if (authRes.status === 401) {
      location.href = '/signup.html?redirect=/assessment.html';
      return;
    }
    const authJson = await authRes.json();
    if (authJson.entitlement) applyEntitlement(authJson.entitlement);
    me = authJson.user;
  } catch (err) {
    console.error(err);
    alert('Unable to verify your session.');
    return;
  }

  renderFormTileGroups();

  const res = await fetch('/api/assessments/catalog');
  if (!res.ok) {
    alert('Unable to load assessment catalog.');
    return;
  }
  const json = await res.json();
  catalog = json.catalog;

  renderCapabilities();
  renderStrategicDrivers();
  renderIndustries();
  renderOrganisations();
  renderCapabilityFocusOptions();
  renderProjectTileGroups();

  if (analyticsPanel) {
    showAnalyticsMessage('Select a project to load analytics.');
  }

  await loadProjects();

  const params = new URLSearchParams(location.search);
  const stageParam = params.get('stage');
  if (stageParam && STAGE_CONFIG[stageParam] && activeProject) {
    selectStage(stageParam);
  }

  if (!activeProject) {
    setValuePulse('Create a project workspace to begin.', { force: true });
  }
}

init();
