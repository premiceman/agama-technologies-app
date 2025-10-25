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
  card.addEventListener('click', () => selectStage(card.dataset.stage));
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
  catalog.strategicDrivers.forEach((driver, index) => {
    const col = document.createElement('div');
    col.className = 'col-md-6';
    const driverSlug = driver
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    const driverId = `driver-${driverSlug || index}`;
    col.innerHTML = `
      <label class="driver-card" for="${driverId}">
        <input class="driver-card-input" type="checkbox" value="${driver}" id="${driverId}" name="strategicDrivers">
        <span class="driver-card-content">${driver}</span>
      </label>`;
    strategicDriversWrap.appendChild(col);
  });
}

function renderIndustries() {
  industrySelect.innerHTML = '<option value="">Select industry</option>';
  catalog.industries.forEach(ind => {
    const opt = document.createElement('option');
    opt.value = ind;
    opt.textContent = ind;
    industrySelect.appendChild(opt);
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
      <div class="form-check persona-check">
        <input class="form-check-input" type="checkbox" value="${persona.id}" id="persona-${persona.id}" name="personaSelection" checked>
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
    if (!currentStage) {
      alert('Select a report tier to continue.');
      return false;
    }
    if (!selectedCapability) {
      alert('Select a primary capability focus.');
      return false;
    }
    if (!industrySelect.value) {
      alert('Select your industry.');
      return false;
    }
    const driversSelected = strategicDriversWrap.querySelectorAll('input[name="strategicDrivers"]:checked');
    if (driversSelected.length === 0) {
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
    const strategicDrivers = Array.from(strategicDriversWrap.querySelectorAll('input[name="strategicDrivers"]:checked')).map(input => input.value);
    const capabilityFocus = Array.from(capabilityFocusSelect.selectedOptions).map(opt => opt.value);
    const selectedPersonas = Array.from(personaWrap.querySelectorAll('input[name="personaSelection"]:checked')).map(input => input.value);
    const personas = personaBlueprint.filter(p => selectedPersonas.includes(p.id));
    const techLandscape = {};
    techLandscapeWrap.querySelectorAll('textarea[data-tech]').forEach(area => {
      techLandscape[area.dataset.tech] = area.value.trim();
    });
    const { answers, extendedAnswers, commandAnswers } = collectAnswers();
    const timeline = gatherTimeline();

    const payload = {
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
  const params = new URLSearchParams(location.search);
  const stageParam = params.get('stage');
  if (stageParam && STAGE_CONFIG[stageParam]) {
    selectStage(stageParam);
  }
}

init();
