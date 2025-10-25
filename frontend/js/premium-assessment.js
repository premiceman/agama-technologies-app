const params = new URLSearchParams(location.search);
const assessmentId = params.get('assessmentId') || params.get('id');

if (!assessmentId) {
  alert('Missing assessment identifier.');
  location.href = '/dashboard.html';
}

const form = document.getElementById('premiumWizard');
const sections = Array.from(document.querySelectorAll('.wizard-section'));
const steps = Array.from(document.querySelectorAll('.wizard-step'));
const prevBtn = document.getElementById('premiumPrev');
const nextBtn = document.getElementById('premiumNext');
const submitBtn = document.getElementById('premiumSubmit');

const capabilityOptions = document.getElementById('premiumCapabilityOptions');
const capabilityFocusSelect = document.getElementById('premiumCapabilityFocus');
const strategicDriversWrap = document.getElementById('premiumStrategicDrivers');
const industrySelect = document.getElementById('premiumIndustry');
const orgSelect = document.getElementById('premiumOrg');
const techLandscapeWrap = document.getElementById('premiumTechLandscape');
const personaWrap = document.getElementById('premiumPersonas');
const questionnaireWrap = document.getElementById('premiumQuestionnaire');
const enrichBtn = document.getElementById('premiumEnrichOrg');
const enrichStatus = document.getElementById('premiumEnrichStatus');
const enrichMatches = document.getElementById('premiumOrgMatches');
const valuePathWrap = document.getElementById('premiumValuePath');
const addPhaseBtn = document.getElementById('premiumAddPhase');
const followUpsPanel = document.getElementById('premiumFollowUps');
const followUpList = document.getElementById('premiumFollowUpList');
const followUpClear = document.getElementById('premiumClearFollowUps');
const loadingOverlay = document.getElementById('premiumLoadingOverlay');
const loadingStatus = document.getElementById('premiumLoadingStatus');
const assistantWidget = document.getElementById('premiumAssistant');
const assistantToggle = assistantWidget?.querySelector('.assistant-toggle');
const assistantPanel = assistantWidget?.querySelector('.assistant-panel');
const assistantClose = assistantWidget?.querySelector('.btn-close');
const assistantForm = document.getElementById('assistantForm');
const assistantPrompt = document.getElementById('assistantPrompt');
const assistantMessages = document.getElementById('assistantMessages');

let currentStep = 1;
let catalog;
let assessment;
let selectedCapability;
let personaBlueprint = [];
let questionsPremium;
let basePillars = new Set();
let orgMatchLookup = [];
let organizationIntelProfile = null;
let valuePathModel = [];
let loadingInterval = null;
const loadingMessages = [
  'Synchronising analyst benchmarks...',
  'Triangulating telemetry choke points...',
  'Routing value path through command uplink...',
  'Projecting ROI nebula trajectories...',
  'Cross-checking procurement guardrails...',
  'Engaging regulatory sentinel protocols...',
  'Mapping persona enablement corridors...'
];

const parseMultiline = (value) =>
  String(value || '')
    .split(/\n+/)
    .map(entry => entry.trim())
    .filter(Boolean);

function showStep(step) {
  currentStep = step;
  sections.forEach(section => section.classList.toggle('d-none', Number(section.dataset.step) !== step));
  steps.forEach(stepEl => stepEl.classList.toggle('active', Number(stepEl.dataset.step) === step));
  prevBtn.disabled = step === 1;
  if (step === sections.length) {
    nextBtn.classList.add('d-none');
    submitBtn.classList.remove('d-none');
  } else {
    nextBtn.classList.remove('d-none');
    submitBtn.classList.add('d-none');
  }
}

function validateStep(step) {
  const section = sections.find(sec => Number(sec.dataset.step) === step);
  if (section) {
    const requiredFields = section.querySelectorAll('input[required], select[required], textarea[required]');
    for (const field of requiredFields) {
      if (!field.reportValidity()) return false;
    }
  }

  if (step === 2) {
    if (!selectedCapability) {
      alert('Select a primary assessment focus.');
      return false;
    }
    const drivers = strategicDriversWrap.querySelectorAll('input[name="strategicDrivers"]:checked');
    if (drivers.length === 0) {
      alert('Select at least one strategic driver.');
      return false;
    }
  }

  if (step === 5) {
    const personasSelected = personaWrap.querySelectorAll('input[name="personaSelection"]:checked');
    if (personasSelected.length === 0) {
      alert('Select at least one persona to tailor the report.');
      return false;
    }
    if (!form.discoveryObjectives.value.trim()) {
      alert('Capture the discovery objectives to tie the roadmap to executive goals.');
      form.discoveryObjectives.focus();
      return false;
    }
  }

  return true;
}

function renderCapabilities() {
  capabilityOptions.innerHTML = '';
  catalog.capabilities.forEach(cap => {
    const col = document.createElement('div');
    col.className = 'col-md-6';
    const checked = assessment.assessmentType === cap.id ? 'checked' : '';
    col.innerHTML = `
      <label class="capability-card ${assessment.assessmentType === cap.id ? 'selected' : ''}" data-id="${cap.id}">
        <input type="radio" name="assessmentType" value="${cap.id}" ${checked}>
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
    }
  });
}

function renderStrategicDrivers() {
  strategicDriversWrap.innerHTML = '';
  catalog.strategicDrivers.forEach(driver => {
    const col = document.createElement('div');
    col.className = 'col-md-6';
    const checked = (assessment.strategicDrivers || []).includes(driver) ? 'checked' : '';
    col.innerHTML = `
      <div class="form-check">
        <input class="form-check-input" type="checkbox" value="${driver}" id="driver-${driver}" name="strategicDrivers" ${checked}>
        <label class="form-check-label" for="driver-${driver}">${driver}</label>
      </div>`;
    strategicDriversWrap.appendChild(col);
  });
}

function renderIndustries() {
  industrySelect.innerHTML = '<option value="">Select industry</option>';
  catalog.industries.forEach(ind => {
    const opt = document.createElement('option');
    opt.value = ind;
    opt.textContent = ind;
    if (assessment.industry === ind) opt.selected = true;
    industrySelect.appendChild(opt);
  });
}

function renderOrganisations() {
  catalog.organisations.forEach(org => {
    const opt = document.createElement('option');
    opt.value = org;
    opt.textContent = org;
    if (assessment.organization?.name === org) opt.selected = true;
    orgSelect.appendChild(opt);
  });
}

function setEnrichmentStatus(message, tone = 'neutral') {
  if (!enrichStatus) return;
  enrichStatus.textContent = message || '';
  enrichStatus.classList.remove('text-success', 'text-warning');
  if (tone === 'success') enrichStatus.classList.add('text-success');
  if (tone === 'warning') enrichStatus.classList.add('text-warning');
}

function renderOrgMatchList(matches = [], confidenceNote) {
  if (!enrichMatches) return;
  orgMatchLookup = Array.isArray(matches) ? matches : [];
  if (!orgMatchLookup.length) {
    enrichMatches.classList.add('d-none');
    enrichMatches.innerHTML = '';
    if (confidenceNote) setEnrichmentStatus(confidenceNote, 'warning');
    return;
  }
  const fragments = document.createDocumentFragment();
  orgMatchLookup.forEach((match, index) => {
    const card = document.createElement('div');
    card.className = 'notice d-flex flex-column gap-1';
    const meta = [match.employeeRange || match.headcountEstimate, match.annualRevenueEstimate, match.hqRegion]
      .filter(Boolean)
      .join(' · ');
    card.innerHTML = `
      <div><strong>${match.name}</strong>${match.classification ? ` · ${match.classification}` : ''}</div>
      ${meta ? `<div class="small text-fg-3">${meta}</div>` : ''}
      ${match.description ? `<div class="small">${match.description}</div>` : ''}
      <button type="button" class="btn btn-outline-light btn-sm align-self-start" data-match-index="${index}">Use this profile</button>
    `;
    fragments.appendChild(card);
  });
  if (confidenceNote) {
    const note = document.createElement('div');
    note.className = 'form-text text-fg-3 mt-2';
    note.textContent = confidenceNote;
    fragments.appendChild(note);
  }
  enrichMatches.innerHTML = '';
  enrichMatches.appendChild(fragments);
  enrichMatches.classList.remove('d-none');
}

async function requestOrganisationIntel({ query, fetchDetailsFor }) {
  try {
    const capabilityId = selectedCapability?.id || assessment.assessmentType;
    const industry = industrySelect?.value || assessment.industry;
    const body = {
      capability: capabilityId,
      industry
    };
    if (query) body.query = query;
    if (fetchDetailsFor) body.fetchDetailsFor = fetchDetailsFor;
    const res = await fetch('/api/organizations/enrich', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body)
    });
    if (res.status === 401) {
      alert('Session expired. Please sign in again.');
      location.href = '/login.html';
      return null;
    }
    if (!res.ok) {
      setEnrichmentStatus('Unable to enrich organisation intelligence at this time.', 'warning');
      return null;
    }
    const json = await res.json();
    if (!json.ok) {
      setEnrichmentStatus(json.error || 'Enrichment failed.', 'warning');
      return null;
    }
    if (query && query.trim()) {
      renderOrgMatchList(json.matches || [], json.confidenceNote);
    }
    if (json.intel) {
      applyOrgIntel(json.intel);
    }
    return json;
  } catch (err) {
    console.error(err);
    setEnrichmentStatus('Enrichment failed. Check your network connection.', 'warning');
    return null;
  }
}

function applyOrgIntel(intel) {
  if (!intel) return;
  const profile = intel.profile || {};
  organizationIntelProfile = profile;
  if (profile.canonicalName && !form.companyName.value.trim()) {
    form.companyName.value = profile.canonicalName;
  }
  if (profile.primaryDomain && form.companyDomain && !form.companyDomain.value.trim()) {
    form.companyDomain.value = profile.primaryDomain;
  }
  if (profile.headcountEstimate && !Number(form.headcount.value)) {
    form.headcount.value = profile.headcountEstimate;
  }
  if (profile.annualRevenueEstimate && !Number(form.annualRevenue.value)) {
    form.annualRevenue.value = profile.annualRevenueEstimate;
  }
  if (profile.turnover && !Number(form.turnover.value)) {
    form.turnover.value = profile.turnover;
  }
  if (profile.investmentHighlights?.length && !form.investmentRounds.value.trim()) {
    form.investmentRounds.value = profile.investmentHighlights.join('\n');
  }
  if (profile.keyInitiatives?.length && !form.keyInitiatives.value.trim()) {
    form.keyInitiatives.value = profile.keyInitiatives
      .map(item => {
        if (typeof item === 'string') return item;
        const base = item.name || '';
        const objective = item.objective ? ` · ${item.objective}` : '';
        return `${base}${objective}`.trim();
      })
      .filter(Boolean)
      .join('\n');
  }
  if (profile.organisationStructure?.length && !form.organisationStructure.value.trim()) {
    form.organisationStructure.value = profile.organisationStructure
      .map(item => {
        if (typeof item === 'string') return item;
        const base = item.function || item.leader || '';
        const remit = item.remit ? ` → ${item.remit}` : '';
        return `${base}${remit}`.trim();
      })
      .filter(Boolean)
      .join('\n');
  }
  if (profile.discoveryObjectives?.length && !form.discoveryObjectives.value.trim()) {
    form.discoveryObjectives.value = profile.discoveryObjectives
      .map(item => {
        if (typeof item === 'string') return item;
        const objective = item.objective || '';
        const kpis = item.linkedKpis ? ` · KPIs: ${Array.isArray(item.linkedKpis) ? item.linkedKpis.join(', ') : item.linkedKpis}` : '';
        const timeframe = item.timeframe ? ` · ${item.timeframe}` : '';
        return `${objective}${kpis}${timeframe}`.trim();
      })
      .filter(Boolean)
      .join('\n');
  }
  if (profile.dataPipelines?.length && form.dataPipelines && !form.dataPipelines.value.trim()) {
    form.dataPipelines.value = profile.dataPipelines
      .map(item => (typeof item === 'string' ? item : `${item.source || item.tool || ''}${item.destination ? ` → ${item.destination}` : ''}`.trim()))
      .filter(Boolean)
      .join('\n');
  }
  if (profile.personaKpis && !organizationIntelProfile.personaKpis) {
    organizationIntelProfile.personaKpis = profile.personaKpis;
  }
  if (intel.summary && !form.narrativeContext.value.trim()) {
    form.narrativeContext.value = intel.summary;
  }
  setEnrichmentStatus(`Loaded intelligence for ${profile.canonicalName || assessment.organization?.name || 'organisation'}.`, 'success');
}

function renderCapabilityFocusOptions() {
  capabilityFocusSelect.innerHTML = '';
  const uniqueDomains = new Set();
  catalog.capabilities.forEach(cap => cap.domains.forEach(d => uniqueDomains.add(d)));
  uniqueDomains.forEach(domain => {
    const opt = document.createElement('option');
    opt.value = domain;
    opt.textContent = domain;
    if ((assessment.capabilityFocus || []).includes(domain)) opt.selected = true;
    capabilityFocusSelect.appendChild(opt);
  });
}

function updateCapabilitySelection() {
  document.querySelectorAll('#premiumCapabilityOptions .capability-card').forEach(card => {
    card.classList.toggle('selected', card.dataset.id === selectedCapability.id);
  });
  personaBlueprint = selectedCapability.personas;
  renderPersonas();
  renderTechLandscape();
  Array.from(capabilityFocusSelect.options).forEach(opt => {
    opt.selected = (assessment.capabilityFocus || []).includes(opt.value) || selectedCapability.domains.includes(opt.value);
  });
}

function renderPersonas() {
  personaWrap.innerHTML = '';
  const selectedPersonaIds = (assessment.personas || []).map(p => p.id || p.title);
  personaBlueprint.forEach(persona => {
    const col = document.createElement('div');
    col.className = 'col-md-6';
    const checked = selectedPersonaIds.includes(persona.id) || selectedPersonaIds.includes(persona.title) ? 'checked' : '';
    col.innerHTML = `
      <div class="form-check">
        <input class="form-check-input" type="checkbox" value="${persona.id}" id="persona-${persona.id}" name="personaSelection" ${checked}>
        <label class="form-check-label" for="persona-${persona.id}">
          <strong>${persona.title}</strong>
          <div class="small text-fg-3">Outcomes: ${persona.outcomes.join(', ')}</div>
        </label>
      </div>`;
    personaWrap.appendChild(col);
  });
}

function renderTechLandscape() {
  techLandscapeWrap.innerHTML = '';
  selectedCapability.technologyLandscape.forEach(item => {
    const col = document.createElement('div');
    col.className = 'col-md-6';
    const value = assessment.techLandscape?.[item.id] || '';
    col.innerHTML = `
      <div class="tech-tile h-100">
        <label for="tech-${item.id}">${item.label}</label>
        <textarea id="tech-${item.id}" class="form-control" rows="3" data-tech="${item.id}">${value}</textarea>
      </div>`;
    techLandscapeWrap.appendChild(col);
  });
}

function prefillCompanyProfile() {
  const profile = assessment.companyProfile || {};
  const intelProfile = assessment.organization?.intel?.profile || {};
  organizationIntelProfile = intelProfile;
  form.companyName.value = profile.name || intelProfile.canonicalName || '';
  if (form.companyDomain) {
    form.companyDomain.value = profile.domain || intelProfile.primaryDomain || '';
  }
  form.headcount.value = profile.headcount || intelProfile.headcountEstimate || '';
  form.annualRevenue.value = profile.annualRevenue || intelProfile.annualRevenueEstimate || '';
  form.turnover.value = profile.turnover || intelProfile.turnover || '';
  form.transformationStage.value = profile.transformationStage || 'Modernisation programme mobilising';
  form.riskAppetite.value = profile.riskAppetite || 'Balanced';
  form.strategicBudget.value = profile.strategicBudget || '';
  form.narrativeContext.value = profile.narrativeContext || '';
  form.complianceDrivers.value = profile.complianceDrivers || '';
  form.customerSegments.value = profile.customerSegments || '';
  const investmentRounds = Array.isArray(profile.investmentRounds)
    ? profile.investmentRounds
    : Array.isArray(intelProfile.investmentHighlights)
      ? intelProfile.investmentHighlights
      : [];
  form.investmentRounds.value = investmentRounds.join('\n');
  const initiatives = Array.isArray(profile.keyInitiatives)
    ? profile.keyInitiatives
    : Array.isArray(intelProfile.keyInitiatives)
      ? intelProfile.keyInitiatives.map(item => `${item.name || ''}${item.objective ? ` · ${item.objective}` : ''}`.trim())
      : [];
  form.keyInitiatives.value = initiatives.join('\n');
  const orgStructure = Array.isArray(profile.organisationStructure)
    ? profile.organisationStructure
    : Array.isArray(intelProfile.organisationStructure)
      ? intelProfile.organisationStructure.map(item => `${item.function || item.leader || ''}${item.remit ? ` → ${item.remit}` : ''}`.trim())
      : [];
  form.organisationStructure.value = orgStructure.join('\n');
  form.preferredVendors.value = assessment.vendorStrategy?.preferredVendors || '';
  form.integrationChallenges.value = assessment.vendorStrategy?.integrationChallenges || '';
  form.operatingRhythms.value = assessment.operatingModel?.operatingRhythms || '';
  form.talentFocus.value = assessment.operatingModel?.talentFocus || '';
  form.processConstraints.value = assessment.operatingModel?.processConstraints || '';
  form.changeManagement.value = assessment.operatingModel?.changeManagement || '';
  if (form.dataPipelines) {
    const pipelines = assessment.operatingModel?.dataPipelines || profile.dataPipelines || [];
    form.dataPipelines.value = Array.isArray(pipelines) ? pipelines.join('\n') : pipelines || '';
  }
  if (form.insightExpectations) {
    const expectations = assessment.operatingModel?.insightExpectations || profile.insightExpectations || '';
    form.insightExpectations.value = Array.isArray(expectations) ? expectations.join('\n') : expectations || '';
  }
  form.successMetrics.value = assessment.operatingModel?.successMetrics || '';
  form.procurementProcess.value = assessment.operatingModel?.procurementProcess || '';
  form.reportingChains.value = assessment.operatingModel?.reportingChains || assessment.operatingModel?.reportingLines || '';
  form.meanTimeToInnocence.value = assessment.operatingModel?.meanTimeToInnocence || assessment.operatingModel?.mtti || '';
  const discoveryObjectives = Array.isArray(assessment.operatingModel?.discoveryObjectives)
    ? assessment.operatingModel.discoveryObjectives
    : Array.isArray(profile.discoveryObjectives)
      ? profile.discoveryObjectives
      : Array.isArray(intelProfile.discoveryObjectives)
        ? intelProfile.discoveryObjectives.map(item =>
            typeof item === 'string'
              ? item
              : `${item.objective || ''}${item.linkedKpis ? ` · KPIs: ${Array.isArray(item.linkedKpis) ? item.linkedKpis.join(', ') : item.linkedKpis}` : ''}${item.timeframe ? ` · ${item.timeframe}` : ''}`.trim()
          )
        : [];
  form.discoveryObjectives.value = discoveryObjectives.join('\n');
  if (intelProfile.dataConfidence) {
    const tone = intelProfile.dataConfidence.toLowerCase().includes('low') ? 'warning' : 'success';
    setEnrichmentStatus(intelProfile.dataConfidence, tone);
  }
}

function renderQuestionnaire() {
  questionnaireWrap.innerHTML = '';
  const baseAnswers = assessment.answers || {};
  const premiumAnswers = assessment.premiumAnswers || {};

  Object.entries(questionsPremium).forEach(([pillar, items]) => {
    const isBase = basePillars.has(pillar);
    const section = document.createElement('div');
    section.className = 'question-pillar';
    section.innerHTML = `<h5>${pillar}<span class="badge-pill">Maturity 0-5 · Urgency 1-5</span></h5>`;
    items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'question-item';
      row.dataset.pillar = pillar;
      row.dataset.question = item.id;
      row.dataset.tier = isBase ? 'base' : 'premium';
      const bucket = isBase ? baseAnswers : premiumAnswers;
      const existing = bucket[pillar]?.[item.id];
      let maturity = 3;
      let urgency = 3;
      if (existing && typeof existing === 'object') {
        maturity = Number.isFinite(existing.maturity) ? existing.maturity : Number(existing.score ?? 3);
        urgency = Number.isFinite(existing.urgency) ? existing.urgency : 3;
      } else if (Number.isFinite(existing)) {
        maturity = Number(existing);
      }
      maturity = Number.isFinite(maturity) ? maturity : 3;
      urgency = Number.isFinite(urgency) ? urgency : 3;

      row.innerHTML = `
        <div class="question-text">${item.text}</div>
        <div class="question-controls">
          <div class="maturity-control">
            <label class="form-label">Maturity</label>
            <input type="range" min="0" max="5" step="1" value="${maturity}" data-maturity>
            <div class="maturity-value" data-maturity-display>${maturity}</div>
          </div>
          <div class="urgency-control">
            <label class="form-label">Urgency</label>
            <select class="form-select" data-urgency>
              ${[1, 2, 3, 4, 5]
                .map(level => {
                  const labels = { 1: 'Low', 2: 'Moderate', 3: 'Important', 4: 'High', 5: 'Critical' };
                  const selected = level === Math.round(urgency) ? 'selected' : '';
                  return `<option value="${level}" ${selected}>${level} · ${labels[level]}</option>`;
                })
                .join('')}
            </select>
          </div>
        </div>
      `;
      section.appendChild(row);
    });
    questionnaireWrap.appendChild(section);
  });
}

questionnaireWrap?.addEventListener('input', (event) => {
  const slider = event.target.closest('[data-maturity]');
  if (slider) {
    const display = slider.parentElement.querySelector('[data-maturity-display]');
    if (display) display.textContent = slider.value;
  }
});

function initialiseValuePath() {
  const existing = assessment.operatingModel?.valuePath;
  if (Array.isArray(existing) && existing.length) {
    valuePathModel = existing.slice(0, 6).map((phase, idx) => ({
      name: phase.name || phase.phase || `Phase ${idx + 1}`,
      duration: phase.duration || '',
      urgency: Number(phase.urgency || 3),
      outcomes: Array.isArray(phase.outcomes) ? phase.outcomes.join('\n') : phase.outcomes || '',
      coverageFocus: phase.coverageFocus || '',
      valueDriver: phase.valueDriver || 'Risk'
    }));
  } else {
    valuePathModel = [
      { name: 'Phase 1 · Mobilise', duration: '0-30 days', urgency: 5, outcomes: '', coverageFocus: '', valueDriver: 'Risk' },
      { name: 'Phase 2 · Stabilise', duration: '30-90 days', urgency: 4, outcomes: '', coverageFocus: '', valueDriver: 'Cost' },
      { name: 'Phase 3 · Scale', duration: 'Quarter 2', urgency: 3, outcomes: '', coverageFocus: '', valueDriver: 'Revenue' },
      { name: 'Phase 4 · Optimise', duration: 'Quarter 3+', urgency: 2, outcomes: '', coverageFocus: '', valueDriver: 'Risk' }
    ];
  }
  renderValuePathEditor();
}

function renderValuePathEditor() {
  if (!valuePathWrap) return;
  valuePathWrap.innerHTML = '';
  valuePathModel.forEach((phase, index) => {
    const card = document.createElement('div');
    card.className = 'value-path-card';
    card.dataset.index = index;
    card.innerHTML = `
      <div class="d-flex flex-wrap gap-3">
        <div class="flex-grow-1">
          <label class="form-label">Phase name</label>
          <input type="text" class="form-control" data-field="name" value="${phase.name || ''}">
        </div>
        <div class="flex-grow-1 flex-md-grow-0" style="min-width:160px;">
          <label class="form-label">Duration</label>
          <input type="text" class="form-control" data-field="duration" value="${phase.duration || ''}">
        </div>
        <div style="width:120px;">
          <label class="form-label">Urgency</label>
          <input type="number" class="form-control" data-field="urgency" min="1" max="5" value="${phase.urgency || 3}">
        </div>
      </div>
      <div class="mt-2">
        <label class="form-label">Outcomes / milestones</label>
        <textarea class="form-control" rows="2" data-field="outcomes">${phase.outcomes || ''}</textarea>
      </div>
      <div class="mt-2">
        <label class="form-label">Coverage focus</label>
        <input class="form-control" data-field="coverageFocus" value="${phase.coverageFocus || ''}">
      </div>
      <div class="mt-2">
        <label class="form-label">Value driver</label>
        <select class="form-select" data-field="valueDriver">
          ${['Risk', 'Revenue', 'Cost']
            .map(option => `<option value="${option}" ${option === (phase.valueDriver || 'Risk') ? 'selected' : ''}>${option}</option>`)
            .join('')}
        </select>
      </div>
      ${index >= 4 ? '<div class="text-end mt-2"><button type="button" class="btn btn-link btn-sm text-danger" data-remove-phase>Remove</button></div>' : ''}
    `;
    valuePathWrap.appendChild(card);
  });
}

function syncValuePathModelFromDom() {
  if (!valuePathWrap) return;
  const cards = valuePathWrap.querySelectorAll('.value-path-card');
  cards.forEach(card => {
    const index = Number(card.dataset.index);
    if (!Number.isFinite(index) || !valuePathModel[index]) return;
    card.querySelectorAll('[data-field]').forEach(field => {
      const key = field.dataset.field;
      if (!key) return;
      if (key === 'urgency') {
        const numeric = Number(field.value || 3);
        valuePathModel[index][key] = Math.min(5, Math.max(1, numeric));
      } else {
        valuePathModel[index][key] = field.value;
      }
    });
  });
}

valuePathWrap?.addEventListener('input', (event) => {
  const card = event.target.closest('.value-path-card');
  if (!card) return;
  syncValuePathModelFromDom();
});

valuePathWrap?.addEventListener('click', (event) => {
  const removeBtn = event.target.closest('[data-remove-phase]');
  if (!removeBtn) return;
  const card = removeBtn.closest('.value-path-card');
  if (!card) return;
  const index = Number(card.dataset.index);
  if (valuePathModel.length <= 4) {
    alert('At least four phases are required for the value path.');
    return;
  }
  valuePathModel.splice(index, 1);
  renderValuePathEditor();
});

if (addPhaseBtn) {
  addPhaseBtn.addEventListener('click', () => {
    syncValuePathModelFromDom();
    valuePathModel.push({
      name: `Custom phase ${valuePathModel.length + 1}`,
      duration: '',
      urgency: 3,
      outcomes: '',
      coverageFocus: '',
      valueDriver: 'Risk'
    });
    renderValuePathEditor();
  });
}

function startLoadingSequence() {
  if (!loadingOverlay) return;
  loadingOverlay.classList.remove('d-none');
  if (loadingInterval) {
    clearInterval(loadingInterval);
    loadingInterval = null;
  }
  let idx = 0;
  if (loadingStatus) {
    loadingStatus.textContent = loadingMessages[idx];
  }
  loadingInterval = setInterval(() => {
    idx = (idx + 1) % loadingMessages.length;
    if (loadingStatus) {
      loadingStatus.textContent = loadingMessages[idx];
    }
  }, 2200);
}

function stopLoadingSequence() {
  if (loadingInterval) {
    clearInterval(loadingInterval);
    loadingInterval = null;
  }
  if (loadingOverlay) {
    loadingOverlay.classList.add('d-none');
  }
}

function collectStepContext(step) {
  switch (step) {
    case 1:
      return {
        companyName: form.companyName.value.trim(),
        domain: form.companyDomain ? form.companyDomain.value.trim() : '',
        headcount: form.headcount.value,
        region: form.region?.value,
        industry: industrySelect?.value
      };
    case 2:
      return {
        capability: selectedCapability?.id,
        strategicDrivers: Array.from(strategicDriversWrap.querySelectorAll('input[name="strategicDrivers"]:checked')).map(input => input.value),
        transformationStage: form.transformationStage.value,
        riskAppetite: form.riskAppetite.value,
        capabilityFocus: Array.from(capabilityFocusSelect.selectedOptions).map(opt => opt.value)
      };
    case 3:
      return {
        annualRevenue: form.annualRevenue.value,
        strategicBudget: form.strategicBudget.value,
        complianceDrivers: form.complianceDrivers.value.trim(),
        customerSegments: form.customerSegments.value.trim(),
        keyInitiatives: parseMultiline(form.keyInitiatives.value),
        narrativeContext: form.narrativeContext.value.trim()
      };
    case 4:
      return {
        techLandscape: Object.fromEntries(Array.from(techLandscapeWrap.querySelectorAll('textarea[data-tech]')).map(area => [area.dataset.tech, area.value.trim()])),
        preferredVendors: form.preferredVendors.value.trim(),
        integrationChallenges: form.integrationChallenges.value.trim(),
        dataPipelines: parseMultiline(form.dataPipelines?.value),
        insightExpectations: parseMultiline(form.insightExpectations?.value)
      };
    case 5:
      return {
        operatingRhythms: form.operatingRhythms.value.trim(),
        talentFocus: form.talentFocus.value.trim(),
        processConstraints: form.processConstraints.value.trim(),
        changeManagement: form.changeManagement.value.trim(),
        procurementProcess: form.procurementProcess.value.trim(),
        reportingChains: form.reportingChains.value.trim(),
        meanTimeToInnocence: form.meanTimeToInnocence.value.trim(),
        discoveryObjectives: parseMultiline(form.discoveryObjectives.value),
        personas: Array.from(personaWrap.querySelectorAll('input[name="personaSelection"]:checked')).map(input => input.value)
      };
    default:
      return null;
  }
}

async function requestFollowUpsForStep(step) {
  const context = collectStepContext(step);
  if (!context || !selectedCapability) return;
  try {
    const res = await fetch('/api/assessments/follow-up', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        step,
        capabilityId: selectedCapability.id,
        answers: context,
        organization: { name: form.companyName.value.trim() },
        industry: industrySelect?.value
      })
    });
    if (!res.ok) return;
    const json = await res.json();
    if (!json.ok || !Array.isArray(json.prompts) || !json.prompts.length) {
      renderFollowUps([]);
      return;
    }
    renderFollowUps(json.prompts);
  } catch (err) {
    console.error('Follow-up prompt error', err);
  }
}

function renderFollowUps(prompts = []) {
  if (!followUpsPanel || !followUpList) return;
  if (!prompts.length) {
    followUpsPanel.classList.add('d-none');
    followUpList.innerHTML = '';
    return;
  }
  followUpList.innerHTML = '';
  prompts.forEach(prompt => {
    const card = document.createElement('div');
    card.className = 'followup-item';
    const question = document.createElement('div');
    question.className = 'fw-semibold';
    question.textContent = prompt.question || 'Provide additional context for this step.';
    card.appendChild(question);
    if (prompt.rationale) {
      const rationale = document.createElement('div');
      rationale.className = 'small text-fg-3';
      rationale.textContent = prompt.rationale;
      card.appendChild(rationale);
    }
    if (Array.isArray(prompt.suggestedOptions) && prompt.suggestedOptions.length) {
      const options = document.createElement('div');
      options.className = 'small mt-1';
      options.textContent = `Suggested options: ${prompt.suggestedOptions.join(', ')}`;
      card.appendChild(options);
    }
    followUpList.appendChild(card);
  });
  followUpsPanel.classList.remove('d-none');
}

followUpClear?.addEventListener('click', () => {
  renderFollowUps([]);
});

function collectAssistantDraft() {
  syncValuePathModelFromDom();
  const strategicDrivers = Array.from(strategicDriversWrap.querySelectorAll('input[name="strategicDrivers"]:checked')).map(input => input.value);
  const capabilityFocus = Array.from(capabilityFocusSelect.selectedOptions).map(opt => opt.value);
  const personasSelected = Array.from(personaWrap.querySelectorAll('input[name="personaSelection"]:checked')).map(input => input.value);
  const techLandscape = {};
  techLandscapeWrap.querySelectorAll('textarea[data-tech]').forEach(area => {
    techLandscape[area.dataset.tech] = area.value.trim();
  });
  return {
    company: {
      name: form.companyName.value.trim(),
      domain: form.companyDomain ? form.companyDomain.value.trim() : '',
      industry: industrySelect?.value,
      headcount: form.headcount.value,
      region: form.region?.value,
      companySize: form.companySize?.value
    },
    focus: {
      capability: selectedCapability?.id,
      strategicDrivers,
      capabilityFocus
    },
    financials: {
      annualRevenue: form.annualRevenue.value,
      strategicBudget: form.strategicBudget.value,
      complianceDrivers: form.complianceDrivers.value.trim(),
      keyInitiatives: parseMultiline(form.keyInitiatives.value)
    },
    technology: {
      landscape: techLandscape,
      dataPipelines: parseMultiline(form.dataPipelines?.value),
      insightExpectations: parseMultiline(form.insightExpectations?.value)
    },
    operatingModel: {
      operatingRhythms: form.operatingRhythms.value.trim(),
      talentFocus: form.talentFocus.value.trim(),
      processConstraints: form.processConstraints.value.trim(),
      changeManagement: form.changeManagement.value.trim(),
      procurementProcess: form.procurementProcess.value.trim(),
      reportingChains: form.reportingChains.value.trim(),
      meanTimeToInnocence: form.meanTimeToInnocence.value.trim(),
      discoveryObjectives: parseMultiline(form.discoveryObjectives.value),
      valuePath: valuePathModel
    },
    personas: personasSelected,
    questionnaire: (() => {
      const snapshot = {};
      questionnaireWrap.querySelectorAll('.question-item').forEach(item => {
        const pillar = item.dataset.pillar;
        const questionId = item.dataset.question;
        if (!pillar || !questionId) return;
        const maturity = item.querySelector('[data-maturity]')?.value;
        const urgency = item.querySelector('[data-urgency]')?.value;
        snapshot[pillar] = snapshot[pillar] || {};
        snapshot[pillar][questionId] = { maturity, urgency };
      });
      return snapshot;
    })()
  };
}

assistantToggle?.addEventListener('click', () => {
  assistantPanel?.classList.toggle('d-none');
  if (!assistantPanel?.classList.contains('d-none')) {
    assistantPrompt?.focus();
  }
});

assistantClose?.addEventListener('click', () => {
  assistantPanel?.classList.add('d-none');
});

assistantForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = assistantPrompt?.value.trim();
  if (!message) return;

  const userBubble = document.createElement('div');
  userBubble.className = 'assistant-message assistant-message--user';
  userBubble.innerHTML = `<div class="assistant-author">You</div><p>${message}</p>`;
  assistantMessages?.appendChild(userBubble);
  assistantMessages?.scrollTo({ top: assistantMessages.scrollHeight, behavior: 'smooth' });

  assistantPrompt.value = '';
  assistantPrompt.disabled = true;

  try {
    const res = await fetch('/api/assessments/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        message,
        capabilityId: selectedCapability?.id || assessment.assessmentType,
        draft: collectAssistantDraft()
      })
    });
    const json = res.ok ? await res.json() : { ok: false, answer: 'Assistant unavailable.' };
    const botBubble = document.createElement('div');
    botBubble.className = 'assistant-message assistant-message--bot';
    botBubble.innerHTML = `<div class="assistant-author">Copilot</div><p>${json.answer || json.error || 'Assistant unavailable.'}</p>`;
    assistantMessages?.appendChild(botBubble);
    assistantMessages?.scrollTo({ top: assistantMessages.scrollHeight, behavior: 'smooth' });
  } catch (err) {
    console.error('Assistant error', err);
    const errorBubble = document.createElement('div');
    errorBubble.className = 'assistant-message assistant-message--bot';
    errorBubble.innerHTML = '<div class="assistant-author">Copilot</div><p>Unable to connect to the assistant right now.</p>';
    assistantMessages?.appendChild(errorBubble);
  } finally {
    if (assistantPrompt) {
      assistantPrompt.disabled = false;
      assistantPrompt.focus();
    }
  }
});
if (enrichBtn) {
  enrichBtn.addEventListener('click', async () => {
    const company = form.companyName.value.trim();
    if (!company) {
      alert('Enter a company name before enriching.');
      form.companyName.focus();
      return;
    }
    enrichBtn.disabled = true;
    setEnrichmentStatus('Sourcing organisation intelligence...');
    await requestOrganisationIntel({ query: company });
    enrichBtn.disabled = false;
  });
}

if (enrichMatches) {
  enrichMatches.addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-match-index]');
    if (!btn) return;
    const index = Number(btn.dataset.matchIndex);
    const match = orgMatchLookup[index];
    if (!match?.name) return;
    setEnrichmentStatus(`Loading detailed profile for ${match.name}...`);
    await requestOrganisationIntel({ fetchDetailsFor: match.name });
  });
}

nextBtn.addEventListener('click', () => {
  if (!validateStep(currentStep)) return;
  const completedStep = currentStep;
  const next = Math.min(currentStep + 1, sections.length);
  showStep(next);
  if (completedStep <= 5) {
    requestFollowUpsForStep(completedStep);
  }
  if (next === 6) {
    syncValuePathModelFromDom();
  }
});

prevBtn.addEventListener('click', () => {
  const prev = Math.max(currentStep - 1, 1);
  showStep(prev);
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!validateStep(6)) return;

  submitBtn.disabled = true;
  submitBtn.textContent = 'Generating...';
  startLoadingSequence();

  try {
    syncValuePathModelFromDom();
    const strategicDrivers = Array.from(strategicDriversWrap.querySelectorAll('input[name="strategicDrivers"]:checked')).map(input => input.value);
    const capabilityFocus = Array.from(capabilityFocusSelect.selectedOptions).map(opt => opt.value);
    const personaIds = Array.from(personaWrap.querySelectorAll('input[name="personaSelection"]:checked')).map(input => input.value);
    const personas = (personaBlueprint || []).filter(p => personaIds.includes(p.id));

    const techLandscape = {};
    techLandscapeWrap.querySelectorAll('textarea[data-tech]').forEach(area => {
      techLandscape[area.dataset.tech] = area.value.trim();
    });

    const answers = {};
    const premiumAnswers = {};
    questionnaireWrap.querySelectorAll('.question-item').forEach(item => {
      const pillar = item.dataset.pillar;
      const questionId = item.dataset.question;
      const tier = item.dataset.tier;
      if (!pillar || !questionId || !tier) return;
      const maturityInput = item.querySelector('[data-maturity]');
      const urgencyInput = item.querySelector('[data-urgency]');
      const maturity = Math.min(5, Math.max(0, Number(maturityInput?.value ?? 0)));
      const urgency = Math.min(5, Math.max(1, Number(urgencyInput?.value ?? 3)));
      const bucket = tier === 'base' ? answers : premiumAnswers;
      bucket[pillar] = bucket[pillar] || {};
      bucket[pillar][questionId] = { maturity, urgency };
    });

    const discoveryObjectives = parseMultiline(form.discoveryObjectives.value);
    const valuePathPayload = valuePathModel.map(phase => ({
      name: phase.name || '',
      duration: phase.duration || '',
      urgency: Math.min(5, Math.max(1, Number(phase.urgency || 3))),
      outcomes: parseMultiline(phase.outcomes),
      coverageFocus: phase.coverageFocus || '',
      valueDriver: phase.valueDriver || 'Risk'
    }));

    const capabilityId = selectedCapability?.id || assessment.assessmentType;

    const payload = {
      assessmentType: capabilityId,
      industry: industrySelect?.value || assessment.industry,
      companySize: form.companySize?.value || assessment.companySize,
      region: form.region?.value || assessment.region,
      strategicDrivers,
      organization: { name: orgSelect.value },
      companyProfile: {
        name: form.companyName.value.trim(),
        domain: form.companyDomain ? form.companyDomain.value.trim() : '',
        headcount: Number(form.headcount.value || 0),
        annualRevenue: Number(form.annualRevenue.value || 0),
        turnover: Number(form.turnover.value || 0),
        region: form.region?.value || '',
        companySize: form.companySize?.value || '',
        transformationStage: form.transformationStage.value,
        riskAppetite: form.riskAppetite.value,
        narrativeContext: form.narrativeContext.value.trim(),
        strategicBudget: Number(form.strategicBudget.value || 0),
        complianceDrivers: form.complianceDrivers.value.trim(),
        customerSegments: form.customerSegments.value.trim(),
        investmentRounds: parseMultiline(form.investmentRounds.value),
        keyInitiatives: parseMultiline(form.keyInitiatives.value),
        organisationStructure: parseMultiline(form.organisationStructure.value),
        discoveryObjectives
      },
      capabilityFocus,
      techLandscape,
      vendorStrategy: {
        preferredVendors: form.preferredVendors.value.trim(),
        integrationChallenges: form.integrationChallenges.value.trim()
      },
      operatingModel: {
        operatingRhythms: form.operatingRhythms.value.trim(),
        talentFocus: form.talentFocus.value.trim(),
        processConstraints: form.processConstraints.value.trim(),
        changeManagement: form.changeManagement.value.trim(),
        procurementProcess: form.procurementProcess.value.trim(),
        reportingChains: form.reportingChains.value.trim(),
        meanTimeToInnocence: form.meanTimeToInnocence.value.trim(),
        successMetrics: form.successMetrics.value.trim(),
        discoveryObjectives,
        dataPipelines: parseMultiline(form.dataPipelines?.value),
        insightExpectations: parseMultiline(form.insightExpectations?.value),
        valuePath: valuePathPayload
      },
      personas,
      answers,
      premiumAnswers
    };

    if (organizationIntelProfile?.personaKpis) {
      payload.companyProfile.personaKpis = organizationIntelProfile.personaKpis;
    }
    if (organizationIntelProfile?.classification && !payload.companyProfile.classification) {
      payload.companyProfile.classification = organizationIntelProfile.classification;
    }

    const architectureSignalsPayload = {};
    if (organizationIntelProfile?.architectureSignals) {
      architectureSignalsPayload.organisationIntel = JSON.stringify(organizationIntelProfile.architectureSignals);
    }
    if (organizationIntelProfile?.renewalCalendar) {
      architectureSignalsPayload.renewalCalendar = JSON.stringify(organizationIntelProfile.renewalCalendar);
    }
    if (Object.keys(architectureSignalsPayload).length) {
      payload.architectureSignals = architectureSignalsPayload;
    }

    const res = await fetch(`/api/assessments/${assessmentId}/premium`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });

    if (res.status === 401) {
      alert('Please sign in to continue.');
      location.href = '/login.html';
      return;
    }

    const json = await res.json();
    if (!json.ok) {
      alert(json.error || 'Unable to update report');
      return;
    }

    location.href = `/report.html?id=${json.reportId}`;
  } catch (err) {
    console.error(err);
    alert('Unexpected error saving premium assessment.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Generate executive report';
    stopLoadingSequence();
  }
});

async function init() {
  try {
    const [catalogRes, assessmentRes, premiumQRes, baseQRes] = await Promise.all([
      fetch('/api/assessments/catalog'),
      fetch(`/api/assessments/${assessmentId}`, { credentials: 'include' }),
      fetch('/api/assessments/questions?stage=premium'),
      fetch('/api/assessments/questions?stage=free')
    ]);

    if (assessmentRes.status === 401) {
      alert('Please sign in to continue.');
      location.href = '/login.html';
      return;
    }

    if (!catalogRes.ok || !assessmentRes.ok || !premiumQRes.ok || !baseQRes.ok) {
      alert('Unable to load premium intake data.');
      return;
    }

    catalog = (await catalogRes.json()).catalog;
    assessment = (await assessmentRes.json()).assessment;
    questionsPremium = (await premiumQRes.json()).questions;
    const baseQuestions = (await baseQRes.json()).questions;
    basePillars = new Set(Object.keys(baseQuestions));

    renderCapabilities();
    renderStrategicDrivers();
    renderIndustries();
    renderOrganisations();
    renderCapabilityFocusOptions();

    selectedCapability = catalog.capabilities.find(cap => cap.id === assessment.assessmentType) || catalog.capabilities[0];
    updateCapabilitySelection();
    prefillCompanyProfile();
    initialiseValuePath();
    renderQuestionnaire();
    showStep(1);
  } catch (err) {
    console.error(err);
    alert('Failed to initialise premium wizard.');
  }
}

init();
