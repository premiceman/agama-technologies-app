const form = document.getElementById('assessmentWizard');
const sections = Array.from(document.querySelectorAll('.wizard-section'));
const progressSteps = Array.from(document.querySelectorAll('.wizard-step'));
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

let currentStep = 1;
let catalog;
let selectedCapability;
let personaBlueprint = [];
let questionnaireLoaded = false;

function showStep(step) {
  currentStep = step;
  sections.forEach(section => {
    section.classList.toggle('d-none', Number(section.dataset.step) !== step);
  });
  progressSteps.forEach(stepEl => {
    const stepNo = Number(stepEl.dataset.step);
    stepEl.classList.toggle('active', stepNo === step);
  });
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
      alert('Select a primary assessment focus to continue.');
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
    return true;
  }
  if (step === 2) {
    const requiredFields = sections[1].querySelectorAll('input[required], select[required]');
    for (const field of requiredFields) {
      if (!field.reportValidity()) {
        return false;
      }
    }
    return true;
  }
  return true;
}

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
    }
  });
}

function renderStrategicDrivers() {
  strategicDriversWrap.innerHTML = '';
  catalog.strategicDrivers.forEach(driver => {
    const col = document.createElement('div');
    col.className = 'col-md-6';
    col.innerHTML = `
      <div class="form-check">
        <input class="form-check-input" type="checkbox" value="${driver}" id="driver-${driver}" name="strategicDrivers">
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
      <div class="form-check">
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

async function loadQuestionnaire() {
  if (questionnaireLoaded) return;
  const res = await fetch('/api/assessments/questions?stage=free');
  if (!res.ok) {
    alert('Unable to load questionnaire.');
    return;
  }
  const json = await res.json();
  questionnaireWrap.innerHTML = '';
  Object.entries(json.questions).forEach(([pillar, items]) => {
    const section = document.createElement('div');
    section.className = 'question-pillar';
    section.innerHTML = `<h5>${pillar}<span class="badge-pill">0-5 scale</span></h5>`;
    items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'question-item';
      row.innerHTML = `
        <label for="${pillar}-${item.id}">${item.text}</label>
        <input type="number" class="form-control" id="${pillar}-${item.id}" data-pillar="${pillar}" data-question="${item.id}" min="0" max="5" step="1" value="3">
      `;
      section.appendChild(row);
    });
    questionnaireWrap.appendChild(section);
  });
  questionnaireLoaded = true;
}

nextBtn.addEventListener('click', async () => {
  if (!validateStep(currentStep)) return;
  if (currentStep === 3 && !questionnaireLoaded) {
    await loadQuestionnaire();
  }
  const next = Math.min(currentStep + 1, sections.length);
  showStep(next);
});

prevBtn.addEventListener('click', () => {
  const prev = Math.max(currentStep - 1, 1);
  showStep(prev);
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!validateStep(4)) return;

  submitBtn.disabled = true;
  submitBtn.textContent = 'Generating...';

  try {
    const strategicDrivers = Array.from(strategicDriversWrap.querySelectorAll('input[name="strategicDrivers"]:checked')).map(
      input => input.value
    );
    const capabilityFocus = Array.from(capabilityFocusSelect.selectedOptions).map(opt => opt.value);
    const selectedPersonas = Array.from(personaWrap.querySelectorAll('input[name="personaSelection"]:checked')).map(
      input => input.value
    );
    const personas = personaBlueprint.filter(p => selectedPersonas.includes(p.id));
    const techLandscape = {};
    techLandscapeWrap.querySelectorAll('textarea[data-tech]').forEach(area => {
      techLandscape[area.dataset.tech] = area.value.trim();
    });
    const answers = {};
    questionnaireWrap.querySelectorAll('input[data-pillar]').forEach(input => {
      const pillar = input.dataset.pillar;
      const qid = input.dataset.question;
      answers[pillar] = answers[pillar] || {};
      answers[pillar][qid] = Number(input.value || 0);
    });

    const payload = {
      stage: 'free',
      assessmentType: selectedCapability.id,
      companySize: form.companySize.value,
      region: form.region.value,
      industry: form.industry.value,
      strategicDrivers,
      organization: { name: orgSelect.value },
      companyProfile: {
        name: form.companyName.value.trim(),
        headcount: Number(form.headcount.value || 0),
        annualRevenue: Number(form.annualRevenue.value || 0),
        transformationStage: form.transformationStage.value,
        riskAppetite: form.riskAppetite.value,
        narrativeContext: form.narrativeContext.value.trim()
      },
      capabilityFocus,
      techLandscape,
      personas,
      answers
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
      alert(json.error || 'Unable to generate report');
      return;
    }

    location.href = `/report.html?id=${json.reportId}`;
  } catch (err) {
    console.error(err);
    alert('Unexpected error generating assessment.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Generate my executive preview';
  }
});

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
  showStep(1);
}

init();
