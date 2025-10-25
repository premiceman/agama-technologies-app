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

let currentStep = 1;
let catalog;
let assessment;
let selectedCapability;
let personaBlueprint = [];
let questionsPremium;
let basePillars = new Set();
let orgMatchLookup = [];
let organizationIntelProfile = null;

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
  if (step === 1) {
    if (!selectedCapability) {
      alert('Select a primary assessment focus.');
      return false;
    }
    const drivers = strategicDriversWrap.querySelectorAll('input[name="strategicDrivers"]:checked');
    if (drivers.length === 0) {
      alert('Select at least one strategic driver.');
      return false;
    }
    return true;
  }
  if (step === 2) {
    const requiredFields = sections[1].querySelectorAll('input[required], select[required]');
    for (const field of requiredFields) {
      if (!field.reportValidity()) return false;
    }
    return true;
  }
  if (step === 4) {
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
  form.successMetrics.value = assessment.operatingModel?.successMetrics || '';
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
    section.innerHTML = `<h5>${pillar}<span class="badge-pill">0-5 scale</span></h5>`;
    items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'question-item';
      const existingValue = (isBase ? baseAnswers[pillar]?.[item.id] : premiumAnswers[pillar]?.[item.id]) ?? 3;
      row.innerHTML = `
        <label for="${pillar}-${item.id}">${item.text}</label>
        <input type="number" class="form-control" id="${pillar}-${item.id}" data-pillar="${pillar}" data-question="${item.id}" data-type="${isBase ? 'base' : 'premium'}" min="0" max="5" step="1" value="${existingValue}">
      `;
      section.appendChild(row);
    });
    questionnaireWrap.appendChild(section);
  });
}

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
  const next = Math.min(currentStep + 1, sections.length);
  showStep(next);
});

prevBtn.addEventListener('click', () => {
  const prev = Math.max(currentStep - 1, 1);
  showStep(prev);
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!validateStep(5)) return;

  submitBtn.disabled = true;
  submitBtn.textContent = 'Updating...';

  try {
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
    questionnaireWrap.querySelectorAll('input[data-pillar]').forEach(input => {
      const pillar = input.dataset.pillar;
      const bucket = input.dataset.type === 'base' ? answers : premiumAnswers;
      bucket[pillar] = bucket[pillar] || {};
      bucket[pillar][input.dataset.question] = Number(input.value || 0);
    });

    const parseList = (value) =>
      String(value || '')
        .split(/\n+/)
        .map(item => item.trim())
        .filter(Boolean);

    const discoveryObjectives = parseList(form.discoveryObjectives.value);

    const capabilityId = selectedCapability?.id || assessment.assessmentType;

    const payload = {
      assessmentType: capabilityId,
      strategicDrivers,
      organization: { name: orgSelect.value },
      companyProfile: {
        name: form.companyName.value.trim(),
        headcount: Number(form.headcount.value || 0),
        annualRevenue: Number(form.annualRevenue.value || 0),
        turnover: Number(form.turnover.value || 0),
        transformationStage: form.transformationStage.value,
        riskAppetite: form.riskAppetite.value,
        narrativeContext: form.narrativeContext.value.trim(),
        strategicBudget: Number(form.strategicBudget.value || 0),
        complianceDrivers: form.complianceDrivers.value.trim(),
        customerSegments: form.customerSegments.value.trim(),
        investmentRounds: parseList(form.investmentRounds.value),
        keyInitiatives: parseList(form.keyInitiatives.value),
        organisationStructure: parseList(form.organisationStructure.value),
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
        successMetrics: form.successMetrics.value.trim(),
        discoveryObjectives
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
    submitBtn.textContent = 'Update my executive report';
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
    renderQuestionnaire();
    showStep(1);
  } catch (err) {
    console.error(err);
    alert('Failed to initialise premium wizard.');
  }
}

init();
