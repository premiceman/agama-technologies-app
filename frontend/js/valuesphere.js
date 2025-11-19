(function () {
  const urgencyOptions = ['Immediate', 'In the next 6 months', 'In the next 12 months', 'Roadmap'];
  const maturityOptions = ['Not in place', 'Partially in place', 'Mostly in place', 'Fully in place', 'Out of scope'];

  const initialTemplate = {
    id: crypto.randomUUID(),
    name: 'Datadog GTM Value Path',
    description: 'Sample BVC assessment for a GTM team covering Inframon, APM, and RUM motions.',
    stages: 5,
    createdAt: new Date().toISOString(),
    areas: [
      {
        id: crypto.randomUUID(),
        name: 'Inframon',
        description: 'Infrastructure monitoring adoption and operational guardrails.',
        questions: [
          { id: crypto.randomUUID(), text: 'How consistently are critical services instrumented with monitors and runbooks?', targetStage: 4 },
          { id: crypto.randomUUID(), text: 'Do SRE and GTM teams share unified health views for incident comms?', targetStage: 3 }
        ]
      },
      {
        id: crypto.randomUUID(),
        name: 'APM',
        description: 'Application performance, distributed tracing, and SLAs.',
        questions: [
          { id: crypto.randomUUID(), text: 'What percentage of tier-1 services are traced end-to-end?', targetStage: 4 },
          { id: crypto.randomUUID(), text: 'How are APM insights tied to business narratives for execs?', targetStage: 3 }
        ]
      },
      {
        id: crypto.randomUUID(),
        name: 'RUM',
        description: 'Digital experience monitoring for customer journeys.',
        questions: [
          { id: crypto.randomUUID(), text: 'Which funnels are tracked with RUM and who owns remediation?', targetStage: 3 },
          { id: crypto.randomUUID(), text: 'Is UX data linked to revenue guardrails and playbooks?', targetStage: 4 }
        ]
      }
    ]
  };

  const defaultState = {
    maturityStages: 5,
    templates: [initialTemplate],
    accounts: [
      {
        id: crypto.randomUUID(),
        name: 'Trailhead Systems',
        tcv: 450000,
        team: 'GTM: Maya & Omar; Consulting: Priya',
        createdAt: new Date().toISOString()
      }
    ],
    assessments: [],
    objectives: [
      { id: crypto.randomUUID(), text: 'Co-create FY25 value map with executive sponsor', status: 'in-progress' },
      { id: crypto.randomUUID(), text: 'Baseline RUM across three revenue-critical journeys', status: 'not-started' }
    ],
    aiSummary: ''
  };

  function loadState() {
    try {
      const stored = localStorage.getItem('valuesphereState');
      if (stored) return JSON.parse(stored);
    } catch (err) {
      console.warn('Falling back to default ValueSphere state', err);
    }
    return { ...defaultState, maturityStages: defaultState.maturityStages };
  }

  function saveState() {
    localStorage.setItem('valuesphereState', JSON.stringify(state));
    render();
  }

  const state = loadState();

  const areaList = document.getElementById('areaList');
  const templateForm = document.getElementById('templateForm');
  const templateName = document.getElementById('templateName');
  const templateDescription = document.getElementById('templateDescription');
  const templateStages = document.getElementById('templateStages');
  const templateLibraryList = document.getElementById('templateLibraryList');
  const globalStages = document.getElementById('globalStages');
  const assessmentAccount = document.getElementById('assessmentAccount');
  const assessmentTemplate = document.getElementById('assessmentTemplate');
  const assessmentForm = document.getElementById('assessmentForm');
  const assessmentDetail = document.getElementById('assessmentDetail');
  const assessmentMeta = document.getElementById('assessmentMeta');
  const analyticsPanel = document.getElementById('analyticsPanel');
  const analyticsTotal = document.getElementById('analyticsTotal');
  const completedAssessmentsList = document.getElementById('completedAssessmentsList');
  const completedAssessmentsCount = document.getElementById('completedAssessmentsCount');
  const accountForm = document.getElementById('accountForm');
  const accountList = document.getElementById('accountList');
  const objectivesList = document.getElementById('objectives');
  const addObjectiveBtn = document.getElementById('addObjective');
  const generateAiSummaryBtn = document.getElementById('generateAiSummary');
  let activeAssessment = null;

  function renderArea(area, index) {
    const areaCard = document.createElement('div');
    areaCard.className = 'glass p-3';
    areaCard.dataset.areaId = area.id;
    areaCard.innerHTML = `
      <div class="d-flex justify-content-between align-items-start gap-2">
        <div class="flex-grow-1">
          <label class="form-label" for="area-${area.id}">Area ${index + 1} name</label>
          <input class="form-control mb-2" id="area-${area.id}" value="${area.name}" placeholder="e.g., Inframon" required>
          <textarea class="form-control" placeholder="Scope and intent" rows="2">${area.description || ''}</textarea>
        </div>
        <button class="btn btn-outline-light btn-sm" type="button" data-remove-area="${area.id}"><i class="bi bi-x"></i></button>
      </div>
      <div class="mt-3">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <strong class="small mb-0">Questions</strong>
          <button class="btn btn-outline-light btn-sm" type="button" data-add-question="${area.id}"><i class="bi bi-plus"></i> Question</button>
        </div>
        <div class="d-flex flex-column gap-2" data-question-list="${area.id}"></div>
      </div>
    `;
    areaList.appendChild(areaCard);

    const questionList = areaCard.querySelector(`[data-question-list="${area.id}"]`);
    area.questions.forEach((question, qIndex) => {
      questionList.appendChild(renderQuestion(question, qIndex));
    });
  }

  function renderQuestion(question, qIndex) {
    const wrapper = document.createElement('div');
    wrapper.className = 'glass p-2';
    wrapper.dataset.questionId = question.id;
    wrapper.innerHTML = `
      <label class="form-label small" for="question-${question.id}">Question ${qIndex + 1}</label>
      <div class="row g-2 align-items-center">
        <div class="col-md-8">
          <input class="form-control" id="question-${question.id}" value="${question.text}" placeholder="What are we evaluating?" required>
        </div>
        <div class="col-md-3">
          <label class="form-label small mb-1" for="target-${question.id}">Target maturity</label>
          <select class="form-select form-select-sm" id="target-${question.id}"></select>
        </div>
        <div class="col-md-1 d-flex justify-content-end">
          <button class="btn btn-outline-light btn-sm" type="button" data-remove-question="${question.id}"><i class="bi bi-trash"></i></button>
        </div>
      </div>
    `;
    const select = wrapper.querySelector(`#target-${question.id}`);
    for (let i = 1; i <= Number(templateStages.value || state.maturityStages); i += 1) {
      const option = document.createElement('option');
      option.value = i;
      option.textContent = `Stage ${i}`;
      if (question.targetStage === i) option.selected = true;
      select.appendChild(option);
    }
    return wrapper;
  }

  function syncAreaQuestions() {
    const cards = Array.from(areaList.children);
    return cards.map(card => {
      const areaId = card.dataset.areaId;
      const nameInput = card.querySelector(`#area-${areaId}`);
      const description = card.querySelector('textarea').value.trim();
      const questions = Array.from(card.querySelectorAll('[data-question-id]')).map(qEl => {
        const qId = qEl.dataset.questionId;
        const text = qEl.querySelector(`#question-${qId}`).value.trim();
        const targetStage = Number(qEl.querySelector(`#target-${qId}`).value);
        return { id: qId, text, targetStage };
      }).filter(q => q.text.length);
      return { id: areaId, name: nameInput.value.trim() || 'Untitled area', description, questions };
    });
  }

  function addArea() {
    const newArea = { id: crypto.randomUUID(), name: '', description: '', questions: [] };
    renderArea(newArea, areaList.children.length);
  }

  function seedBuilderFromTemplate(template) {
    areaList.innerHTML = '';
    const sourceAreas = template?.areas?.length ? template.areas : [addBlankArea()];
    sourceAreas.forEach((area, idx) => {
      const areaClone = {
        ...area,
        id: crypto.randomUUID(),
        questions: (area.questions || []).map(question => ({ ...question, id: crypto.randomUUID() }))
      };
      renderArea(areaClone, idx);
    });
    refreshQuestionTargets();
  }

  function loadTemplateToBuilder(templateId) {
    const template = state.templates.find(t => t.id === templateId);
    if (!template) return;
    templateName.value = template.name || '';
    templateDescription.value = template.description || '';
    templateStages.value = template.stages || state.maturityStages;
    seedBuilderFromTemplate(template);
  }

  function addBlankArea() {
    return { id: crypto.randomUUID(), name: '', description: '', questions: [{ id: crypto.randomUUID(), text: '', targetStage: 1 }] };
  }

  function handleTemplateSubmit(event) {
    event.preventDefault();
    const areas = syncAreaQuestions();
    if (!areas.length) {
      alert('Please add at least one assessment area.');
      return;
    }
    const hasEmptyArea = areas.some(area => !area.questions.length);
    if (hasEmptyArea) {
      alert('Each area needs at least one question.');
      return;
    }
    const template = {
      id: crypto.randomUUID(),
      name: templateName.value.trim(),
      description: templateDescription.value.trim(),
      stages: Number(templateStages.value) || state.maturityStages,
      areas,
      createdAt: new Date().toISOString()
    };
    state.templates.unshift(template);
    saveState();
    templateForm.reset();
    areaList.innerHTML = '';
    templateStages.value = state.maturityStages;
    templateDescription.value = '';
    alert('Template saved. It is now available for assessments.');
  }

  function populateTemplateFormDefaults() {
    templateStages.value = state.maturityStages;
  }

  function renderTemplateOptions() {
    assessmentTemplate.innerHTML = '';
    state.templates.forEach(template => {
      const option = document.createElement('option');
      option.value = template.id;
      option.textContent = `${template.name} (${template.areas.length} areas)`;
      assessmentTemplate.appendChild(option);
    });
  }

  function renderTemplateLibrary() {
    templateLibraryList.innerHTML = '';
    if (!state.templates.length) {
      templateLibraryList.innerHTML = '<p class="text-fg-3 small mb-0">No templates yet. Create one to seed your library.</p>';
      return;
    }

    state.templates.forEach(template => {
      const card = document.createElement('div');
      card.className = 'glass p-3';
      const createdLabel = template.createdAt ? new Date(template.createdAt).toLocaleDateString() : 'Recently added';
      card.innerHTML = `
        <div class="d-flex justify-content-between align-items-start gap-3">
          <div>
            <strong>${template.name}</strong>
            <p class="mb-1 small text-fg-3">${template.description || 'Template ready to reuse.'}</p>
            <p class="mb-0 small text-fg-3">${template.areas.length} areas · ${template.stages || state.maturityStages} stages</p>
          </div>
          <div class="text-end">
            <span class="badge-soft">${createdLabel}</span>
          </div>
        </div>
        <div class="d-flex justify-content-between align-items-center gap-2 mt-2 flex-wrap">
          <div class="small text-fg-3">Ready for Navigator &amp; assessments</div>
          <button class="btn btn-outline-light btn-sm" type="button" data-load-template="${template.id}">Load in builder</button>
        </div>
      `;
      templateLibraryList.appendChild(card);
    });
  }

  function renderAccountOptions() {
    assessmentAccount.innerHTML = '';
    state.accounts.forEach(account => {
      const option = document.createElement('option');
      option.value = account.id;
      option.textContent = account.name;
      assessmentAccount.appendChild(option);
    });
  }

  function renderAccounts() {
    accountList.innerHTML = '';
    if (!state.accounts.length) {
      accountList.innerHTML = '<p class="text-fg-3 small mb-0">No accounts yet. Create one to begin.</p>';
      return;
    }
    state.accounts.forEach(account => {
      const card = document.createElement('div');
      card.className = 'glass p-3';
      card.innerHTML = `
        <div class="d-flex justify-content-between align-items-start">
          <div>
            <strong>${account.name}</strong>
            <p class="mb-1 small text-fg-3">TCV: ${account.tcv ? `$${Number(account.tcv).toLocaleString()}` : 'Not set'}</p>
            <p class="mb-0 small text-fg-3">Team: ${account.team || 'Not set'}</p>
          </div>
          <span class="badge-soft">${new Date(account.createdAt).toLocaleDateString()}</span>
        </div>
      `;
      accountList.appendChild(card);
    });
  }

  function renderCompletedAssessments() {
    completedAssessmentsList.innerHTML = '';
    completedAssessmentsCount.textContent = `${state.assessments.length} recorded`;
    if (!state.assessments.length) {
      completedAssessmentsList.innerHTML = '<p class="text-fg-3 small mb-0">Complete an assessment to see it appear here.</p>';
      return;
    }

    state.assessments.slice(0, 6).forEach(assessment => {
      const account = state.accounts.find(acc => acc.id === assessment.accountId);
      const template = state.templates.find(t => t.id === assessment.templateId);
      const card = document.createElement('div');
      card.className = 'glass p-3';
      card.innerHTML = `
        <div class="d-flex justify-content-between align-items-start gap-2 flex-wrap">
          <div>
            <strong>${assessment.name || 'Assessment'}</strong>
            <p class="mb-1 small text-fg-3">${assessment.date || 'Not dated'} · ${template?.name || 'Template removed'}</p>
            <p class="mb-0 small text-fg-3">Account: ${account?.name || 'Unknown'} · Owner: ${assessment.takenBy || assessment.owner || 'Not recorded'}</p>
            <p class="mb-0 small text-fg-3">Customer team: ${assessment.customerContributors || 'Not captured'}</p>
          </div>
          <div class="text-end">
            <span class="badge-soft">${new Date(assessment.date || new Date()).toLocaleDateString()}</span>
            <button class="btn btn-outline-light btn-sm mt-2" type="button" data-open-assessment="${assessment.id}">Open</button>
          </div>
        </div>
      `;
      completedAssessmentsList.appendChild(card);
    });
  }

  function handleAccountSubmit(event) {
    event.preventDefault();
    const name = document.getElementById('accountName').value.trim();
    const tcv = Number(document.getElementById('accountTcv').value) || 0;
    const team = document.getElementById('accountTeam').value.trim();
    state.accounts.unshift({ id: crypto.randomUUID(), name, tcv, team, createdAt: new Date().toISOString() });
    saveState();
    accountForm.reset();
    renderAccountOptions();
  }

  function buildAssessmentPayload(templateId) {
    const template = state.templates.find(t => t.id === templateId);
    if (!template) return null;
    return {
      ...template,
      areas: template.areas.map(area => ({
        ...area,
        questions: area.questions.map(question => ({ ...question, response: '', notes: '', urgency: urgencyOptions[3], maturity: maturityOptions[4] }))
      }))
    };
  }

  function renderAssessmentDetail(assessment) {
    assessmentDetail.innerHTML = '';
    assessment.areas.forEach((area, idx) => {
      const item = document.createElement('div');
      item.className = 'accordion-item bg-transparent border-soft';
      item.innerHTML = `
        <h2 class="accordion-header" id="area-heading-${area.id}">
          <button class="accordion-button ${idx === 0 ? '' : 'collapsed'}" type="button" data-bs-toggle="collapse" data-bs-target="#area-${area.id}" aria-expanded="${idx === 0}" aria-controls="area-${area.id}">
            <div class="d-flex flex-column">
              <span class="fw-semibold">${area.name}</span>
              <span class="text-fg-3 small">${area.description || 'Assessment area'}</span>
            </div>
          </button>
        </h2>
        <div id="area-${area.id}" class="accordion-collapse collapse ${idx === 0 ? 'show' : ''}" aria-labelledby="area-heading-${area.id}" data-bs-parent="#assessmentDetail">
          <div class="accordion-body bg-transparent">
            <div class="d-flex flex-column gap-3">
              ${area.questions.map(question => renderAssessmentQuestion(question, assessment.id)).join('')}
            </div>
          </div>
        </div>
      `;
      assessmentDetail.appendChild(item);
    });
  }

  function renderAssessmentMeta(assessment) {
    if (!assessment) {
      assessmentMeta.classList.add('d-none');
      assessmentMeta.innerHTML = '';
      return;
    }
    const account = state.accounts.find(acc => acc.id === assessment.accountId);
    const template = state.templates.find(t => t.id === assessment.templateId);
    const customerTeam = assessment.customerContributors || 'Not captured yet';
    const owner = assessment.takenBy || assessment.owner || 'Not recorded';
    assessmentMeta.innerHTML = `
      <div class="d-flex justify-content-between align-items-start flex-wrap gap-2">
        <div>
          <strong>${assessment.name || 'Assessment'}</strong>
          <p class="mb-1 small text-fg-3">${template?.name || 'Template removed'} · ${account?.name || 'No account selected'}</p>
          <p class="mb-0 small text-fg-3">Taken by ${owner} · Customer contributors: ${customerTeam}</p>
        </div>
        <div class="text-end small text-fg-3">
          <div>${assessment.date || 'Not dated'}</div>
          ${assessment.owner ? `<div>Account team: ${assessment.owner}</div>` : ''}
        </div>
      </div>
    `;
    assessmentMeta.classList.remove('d-none');
  }

  function renderAssessmentQuestion(question, assessmentId) {
    const urgencySelect = urgencyOptions
      .map(option => `<option value="${option}" ${question.urgency === option ? 'selected' : ''}>${option}</option>`)
      .join('');
    const maturitySelect = maturityOptions
      .map(option => `<option value="${option}" ${question.maturity === option ? 'selected' : ''}>${option}</option>`)
      .join('');
    return `
      <div class="glass p-3" data-question="${question.id}" data-assessment="${assessmentId}">
        <div class="d-flex justify-content-between flex-wrap align-items-start gap-2 mb-2">
          <div>
            <strong>${question.text}</strong>
            <p class="small text-fg-3 mb-0">Target stage: ${question.targetStage}</p>
          </div>
          <div class="d-flex gap-2 flex-wrap">
            <select class="form-select form-select-sm" data-urgency>
              ${urgencySelect}
            </select>
            <select class="form-select form-select-sm" data-maturity>
              ${maturitySelect}
            </select>
          </div>
        </div>
        <div class="row g-2">
          <div class="col-md-6">
            <label class="form-label small">Answer</label>
            <textarea class="form-control" rows="2" data-response placeholder="Document the customer response"></textarea>
          </div>
          <div class="col-md-6">
            <label class="form-label small">Notes</label>
            <textarea class="form-control" rows="2" data-notes placeholder="Context, owners, blockers"></textarea>
          </div>
        </div>
      </div>
    `;
  }

  function attachAssessmentListeners(currentAssessment) {
    activeAssessment = currentAssessment;
  }

  function setActiveAssessment(assessment) {
    attachAssessmentListeners(assessment);
    if (!assessment) {
      renderAssessmentMeta();
      assessmentDetail.innerHTML = '';
      return;
    }
    renderAssessmentMeta(assessment);
    renderAssessmentDetail(assessment);
  }

  function persistAssessment(assessment) {
    const index = state.assessments.findIndex(a => a.id === assessment.id);
    if (index > -1) {
      state.assessments[index] = assessment;
      saveState();
    }
  }

  function handleAssessmentSubmit(event) {
    event.preventDefault();
    const accountId = assessmentAccount.value;
    const templateId = assessmentTemplate.value;
    const templatePayload = buildAssessmentPayload(templateId);
    if (!templatePayload) {
      alert('Select a template to continue.');
      return;
    }
    const takenBy = document.getElementById('assessmentTakenBy').value.trim();
    const customerContributors = document.getElementById('customerContributors').value.trim();
    const assessment = {
      id: crypto.randomUUID(),
      name: document.getElementById('assessmentName').value.trim(),
      owner: document.getElementById('assessmentOwner').value.trim(),
      date: document.getElementById('assessmentDate').value || new Date().toISOString().split('T')[0],
      accountId,
      templateId,
      takenBy,
      customerContributors,
      createdAt: new Date().toISOString(),
      areas: templatePayload.areas
    };
    state.assessments.unshift(assessment);
    saveState();
    setActiveAssessment(assessment);
    renderAnalytics();
    alert('Assessment created. Sections are ready for input.');
  }

  function renderAnalytics() {
    analyticsPanel.innerHTML = '';
    analyticsTotal.textContent = `${state.assessments.length} assessments`;
    if (!state.assessments.length) {
      analyticsPanel.innerHTML = '<p class="text-fg-3 small mb-0">Complete an assessment to see urgency and maturity trends.</p>';
      return;
    }

    const urgencyCount = {};
    const maturityCount = {};
    state.assessments.forEach(assessment => {
      assessment.areas.forEach(area => {
        area.questions.forEach(question => {
          urgencyCount[question.urgency] = (urgencyCount[question.urgency] || 0) + 1;
          maturityCount[question.maturity] = (maturityCount[question.maturity] || 0) + 1;
        });
      });
    });

    const urgencyCard = document.createElement('div');
    urgencyCard.className = 'glass p-3';
    urgencyCard.innerHTML = `<strong class="small d-block mb-2">Urgency mix</strong>${renderDistribution(urgencyCount)}`;

    const maturityCard = document.createElement('div');
    maturityCard.className = 'glass p-3';
    maturityCard.innerHTML = `<strong class="small d-block mb-2">Maturity distribution</strong>${renderDistribution(maturityCount)}`;

    analyticsPanel.appendChild(urgencyCard);
    analyticsPanel.appendChild(maturityCard);
  }

  function renderDistribution(map) {
    const entries = Object.entries(map);
    if (!entries.length) return '<p class="text-fg-3 small mb-0">No data yet.</p>';
    const total = entries.reduce((sum, [, value]) => sum + value, 0);
    return entries
      .map(([label, value]) => {
        const pct = Math.round((value / total) * 100);
        return `
          <div class="mb-1">
            <div class="d-flex justify-content-between small"><span>${label}</span><span>${pct}%</span></div>
            <div class="progress" role="progressbar" aria-label="${label}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" style="height:6px;">
              <div class="progress-bar bg-info" style="width:${pct}%"></div>
            </div>
          </div>
        `;
      })
      .join('');
  }

  function renderObjectives() {
    objectivesList.innerHTML = '';
    if (!state.objectives.length) {
      objectivesList.innerHTML = '<p class="text-fg-3 small mb-0">No objectives yet.</p>';
      return;
    }
    state.objectives.forEach(objective => {
      const row = document.createElement('div');
      row.className = 'glass p-2 d-flex align-items-center gap-2';
      row.innerHTML = `
        <input class="form-check-input" type="checkbox" ${objective.status === 'done' ? 'checked' : ''} data-objective="${objective.id}">
        <span class="flex-grow-1 small">${objective.text}</span>
        <button class="btn btn-outline-light btn-sm" type="button" data-remove-objective="${objective.id}"><i class="bi bi-x"></i></button>
      `;
      objectivesList.appendChild(row);
    });
  }

  function handleObjectiveToggle(event) {
    const checkbox = event.target.closest('[data-objective]');
    if (!checkbox) return;
    const id = checkbox.dataset.objective;
    const objective = state.objectives.find(obj => obj.id === id);
    if (!objective) return;
    objective.status = checkbox.checked ? 'done' : 'in-progress';
    saveState();
  }

  function handleObjectiveRemove(event) {
    const btn = event.target.closest('[data-remove-objective]');
    if (!btn) return;
    const id = btn.dataset.removeObjective;
    state.objectives = state.objectives.filter(obj => obj.id !== id);
    saveState();
  }

  function addObjective() {
    const text = prompt('Objective description');
    if (!text) return;
    state.objectives.unshift({ id: crypto.randomUUID(), text, status: 'not-started' });
    saveState();
  }

  function bindAreaEvents() {
    areaList.addEventListener('click', event => {
      if (event.target.closest('[data-add-question]')) {
        const areaId = event.target.closest('[data-add-question]').dataset.addQuestion;
        const card = areaList.querySelector(`[data-area-id="${areaId}"]`);
        const questionList = card.querySelector(`[data-question-list="${areaId}"]`);
        const newQuestion = { id: crypto.randomUUID(), text: '', targetStage: 1 };
        questionList.appendChild(renderQuestion(newQuestion, questionList.children.length));
      }
      if (event.target.closest('[data-remove-area]')) {
        const id = event.target.closest('[data-remove-area]').dataset.removeArea;
        const target = areaList.querySelector(`[data-area-id="${id}"]`);
        if (target) target.remove();
      }
      if (event.target.closest('[data-remove-question]')) {
        const id = event.target.closest('[data-remove-question]').dataset.removeQuestion;
        const question = areaList.querySelector(`[data-question-id="${id}"]`);
        if (question) question.remove();
      }
    });
  }

  function handleGlobalStagesChange() {
    state.maturityStages = Number(globalStages.value) || defaultState.maturityStages;
    templateStages.value = state.maturityStages;
    refreshQuestionTargets();
    saveState();
  }

  function handleResetTemplate() {
    populateTemplateFormDefaults();
    seedBuilderFromTemplate();
  }

  function handleGenerateAiSummary(event) {
    event.preventDefault();
    const latestAssessment = state.assessments[0];
    if (!latestAssessment) {
      alert('Create an assessment first.');
      return;
    }
    const account = state.accounts.find(acc => acc.id === latestAssessment.accountId);
    const urgencyHighlights = collectTopValues(latestAssessment, 'urgency', 2);
    const maturityHighlights = collectTopValues(latestAssessment, 'maturity', 2);
    state.aiSummary = `For ${account?.name || 'the account'}, ValueSphere synthesized ${latestAssessment.areas.length} areas. Urgency is led by ${urgencyHighlights.join(' & ')}, while maturity signals concentrate around ${maturityHighlights.join(' & ')}. Recommended path: focus on the top urgency items, align on target stage ${state.maturityStages}, and capture progression in the next assessment.`;
    saveState();
    alert('AI summary drafted and stored with the account.');
  }

  function collectTopValues(assessment, field, limit) {
    const count = {};
    assessment.areas.forEach(area => {
      area.questions.forEach(q => {
        const key = q[field];
        count[key] = (count[key] || 0) + 1;
      });
    });
    return Object.entries(count)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([label]) => label || 'n/a');
  }

  function handleAssessmentChange(event) {
    if (!activeAssessment) return;
    const container = event.target.closest('[data-question]');
    if (!container) return;
    const questionId = container.dataset.question;
    const area = activeAssessment.areas.find(a => a.questions.some(q => q.id === questionId));
    const question = area?.questions.find(q => q.id === questionId);
    if (!question) return;
    if (event.target.dataset.response !== undefined) question.response = event.target.value;
    if (event.target.dataset.notes !== undefined) question.notes = event.target.value;
    if (event.target.dataset.urgency !== undefined) question.urgency = event.target.value;
    if (event.target.dataset.maturity !== undefined) question.maturity = event.target.value;
    persistAssessment(activeAssessment);
  }

  function handleTemplateLibraryClick(event) {
    const loadBtn = event.target.closest('[data-load-template]');
    if (!loadBtn) return;
    loadTemplateToBuilder(loadBtn.dataset.loadTemplate);
    document.getElementById('templateStudio').scrollIntoView({ behavior: 'smooth' });
  }

  function handleCompletedAssessmentOpen(event) {
    const btn = event.target.closest('[data-open-assessment]');
    if (!btn) return;
    const assessment = state.assessments.find(a => a.id === btn.dataset.openAssessment);
    if (assessment) setActiveAssessment(assessment);
  }

  function render() {
    globalStages.value = state.maturityStages;
    renderTemplateOptions();
    renderTemplateLibrary();
    renderAccountOptions();
    renderAccounts();
    renderObjectives();
    renderAnalytics();
    renderCompletedAssessments();
    renderAssessmentMeta(activeAssessment);
  }

  function initDefaults() {
    populateTemplateFormDefaults();
    seedBuilderFromTemplate(state.templates[0]);
    if (state.assessments[0]) {
      setActiveAssessment(state.assessments[0]);
    }
  }

  function refreshQuestionTargets() {
    const maxStage = Number(templateStages.value || state.maturityStages);
    areaList.querySelectorAll('[data-question-id]').forEach(questionEl => {
      const select = questionEl.querySelector('select');
      const currentValue = Number(select.value) || 1;
      select.innerHTML = '';
      for (let i = 1; i <= maxStage; i += 1) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `Stage ${i}`;
        if (i === currentValue) option.selected = true;
        select.appendChild(option);
      }
    });
  }

  bindAreaEvents();
  render();
  initDefaults();

  document.getElementById('addArea').addEventListener('click', addArea);
  templateForm.addEventListener('submit', handleTemplateSubmit);
  templateForm.addEventListener('reset', handleResetTemplate);
  templateStages.addEventListener('change', refreshQuestionTargets);
  accountForm.addEventListener('submit', handleAccountSubmit);
  assessmentForm.addEventListener('submit', handleAssessmentSubmit);
  globalStages.addEventListener('change', handleGlobalStagesChange);
  addObjectiveBtn.addEventListener('click', addObjective);
  objectivesList.addEventListener('change', handleObjectiveToggle);
  objectivesList.addEventListener('click', handleObjectiveRemove);
  generateAiSummaryBtn.addEventListener('click', handleGenerateAiSummary);
  assessmentDetail.addEventListener('input', handleAssessmentChange);
  assessmentDetail.addEventListener('change', handleAssessmentChange);
  templateLibraryList.addEventListener('click', handleTemplateLibraryClick);
  completedAssessmentsList.addEventListener('click', handleCompletedAssessmentOpen);
})();
