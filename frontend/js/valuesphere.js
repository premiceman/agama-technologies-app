(function () {
  const state = {
    context: null,
    templates: [],
    assessments: [],
    selectedAssessment: null
  };

  const els = {
    status: document.getElementById('valuesphereStatus'),
    personaLabel: document.getElementById('personaLabel'),
    templateLibrary: document.getElementById('templateLibraryList'),
    templateLibraryEmpty: document.getElementById('templateLibraryEmpty'),
    templateLibraryError: document.getElementById('templateLibraryError'),
    templateForm: document.getElementById('templateForm'),
    templateSections: document.getElementById('templateSections'),
    addSectionBtn: document.getElementById('addTemplateSection'),
    templateCount: document.getElementById('templateCount'),
    assessmentCount: document.getElementById('assessmentCount'),
    completedCount: document.getElementById('completedCount'),
    recentAssessments: document.getElementById('recentAssessments'),
    assessmentList: document.getElementById('assessmentList'),
    assessmentEmpty: document.getElementById('assessmentEmpty'),
    assessmentDetail: document.getElementById('assessmentDetail'),
    assessmentTitle: document.getElementById('assessmentTitle'),
    assessmentVendor: document.getElementById('assessmentVendor'),
    assessmentState: document.getElementById('assessmentState'),
    assessmentSummary: document.getElementById('assessmentSummary'),
    assessmentCriteria: document.getElementById('assessmentCriteria'),
    assessmentScoring: document.getElementById('assessmentScoring'),
    assessmentStakeholders: document.getElementById('assessmentStakeholders'),
    assessmentTags: document.getElementById('assessmentTags'),
    assessmentMeta: document.getElementById('assessmentMeta'),
    transitionShared: document.getElementById('transitionShared'),
    transitionAgreed: document.getElementById('transitionAgreed'),
    transitionLocked: document.getElementById('transitionLocked'),
    assessmentCreateForm: document.getElementById('assessmentCreateForm'),
    assessmentTemplateSelect: document.getElementById('assessmentTemplateSelect'),
    completedAssessments: document.getElementById('completedAssessments')
  };

  function showStatus(message, tone = 'info') {
    if (!els.status) return;
    els.status.textContent = message || '';
    els.status.className = 'alert mb-3';
    els.status.classList.add(tone === 'error' ? 'alert-danger' : tone === 'success' ? 'alert-success' : 'alert-info');
    els.status.classList.toggle('d-none', !message);
  }

  async function fetchJson(url, options = {}) {
    const response = await fetch(url, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const errorMessage = data.error || data.message || 'Unexpected error';
      throw new Error(errorMessage);
    }
    return data;
  }

  function applyTheme(context) {
    const persona = context?.activePersona || context?.themeHints?.persona || 'seller';
    const theme = persona === 'buyer' ? 'buyer' : persona === 'shared' ? 'shared' : 'vendor';
    document.body.dataset.theme = theme;
    if (els.personaLabel) {
      const label = theme === 'buyer' ? 'Buyer mode' : theme === 'shared' ? 'Shared mode' : 'Seller mode';
      els.personaLabel.textContent = label;
    }
  }

  function createSectionCard() {
    const section = document.createElement('div');
    section.className = 'card glass p-3 mb-3';
    section.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-2">
        <div>
          <label class="form-label mb-1">Section title</label>
          <input class="form-control form-control-sm section-title" placeholder="Technical fit" required />
        </div>
        <div class="ms-3" style="width: 160px;">
          <label class="form-label mb-1">Weight</label>
          <input class="form-control form-control-sm section-weight" type="number" step="0.1" min="0" max="1" value="1" />
        </div>
      </div>
      <div class="mb-2">
        <label class="form-label mb-1">Description</label>
        <input class="form-control form-control-sm section-description" placeholder="What we are measuring" />
      </div>
      <div class="mb-2">
        <div class="d-flex justify-content-between align-items-center">
          <span class="small text-fg-3">Questions</span>
          <button type="button" class="btn btn-outline-light btn-sm add-question">Add question</button>
        </div>
        <div class="question-list d-flex flex-column gap-2 mt-2"></div>
      </div>
      <button type="button" class="btn btn-outline-light btn-sm remove-section">Remove section</button>
    `;

    section.querySelector('.add-question').addEventListener('click', () => {
      const list = section.querySelector('.question-list');
      const row = document.createElement('div');
      row.className = 'glass p-2 rounded d-flex flex-wrap gap-2 align-items-center';
      row.innerHTML = `
        <input class="form-control form-control-sm flex-grow-1 question-label" placeholder="API fit" required />
        <select class="form-select form-select-sm question-type" style="max-width: 140px;">
          <option value="text">Text</option>
          <option value="numeric">Numeric</option>
        </select>
        <input class="form-control form-control-sm question-weight" type="number" step="0.1" min="0" max="1" value="1" style="max-width: 120px;" />
        <button type="button" class="btn btn-outline-light btn-sm remove-question"><i class="bi bi-x"></i></button>
      `;
      row.querySelector('.remove-question').addEventListener('click', () => row.remove());
      list.appendChild(row);
    });

    section.querySelector('.remove-section').addEventListener('click', () => section.remove());
    return section;
  }

  function serialiseTemplateSections() {
    if (!els.templateSections) return [];
    const sections = [];
    const sectionCards = els.templateSections.querySelectorAll('.card');
    sectionCards.forEach(card => {
      const title = card.querySelector('.section-title')?.value?.trim();
      if (!title) return;
      const weightRaw = card.querySelector('.section-weight')?.value;
      const description = card.querySelector('.section-description')?.value?.trim();
      const questions = [];
      card.querySelectorAll('.question-list .glass').forEach(q => {
        const label = q.querySelector('.question-label')?.value?.trim();
        if (!label) return;
        const type = q.querySelector('.question-type')?.value || 'text';
        const weight = parseFloat(q.querySelector('.question-weight')?.value || '0');
        questions.push({ questionId: crypto.randomUUID(), label, type, weight });
      });
      sections.push({ sectionId: crypto.randomUUID(), title, weight: parseFloat(weightRaw || '0'), description, questions });
    });
    return sections;
  }

  function renderTemplates() {
    if (!els.templateLibrary) return;
    els.templateLibrary.innerHTML = '';

    if (state.templates.length === 0) {
      if (els.templateLibraryEmpty) els.templateLibraryEmpty.classList.remove('d-none');
      return;
    }

    if (els.templateLibraryEmpty) els.templateLibraryEmpty.classList.add('d-none');

    state.templates.forEach(template => {
      const card = document.createElement('div');
      card.className = 'card glass p-3 h-100';
      card.innerHTML = `
        <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
          <div>
            <strong class="d-block">${template.name}</strong>
            <span class="text-fg-3 small">Version ${template.versionNumber || 1}${template.isDeprecated ? ' · Deprecated' : ''}</span>
          </div>
          <span class="badge-soft">${template.mode === 'seller' ? 'Seller' : template.mode === 'shared' ? 'Shared' : 'Buyer'}</span>
        </div>
        <p class="text-fg-3 small mb-2">${template.description || 'No description provided.'}</p>
        <div class="small text-fg-3">${(template.sections || []).length} sections · Updated ${new Date(template.updatedAt || template.createdAt || Date.now()).toLocaleDateString()}</div>
      `;
      els.templateLibrary.appendChild(card);
    });
  }

  function renderOverview() {
    if (els.templateCount) els.templateCount.textContent = state.templates.length;
    if (els.assessmentCount) els.assessmentCount.textContent = state.assessments.length;
    const completed = state.assessments.filter(a => a.state === 'locked');
    if (els.completedCount) els.completedCount.textContent = completed.length;

    if (els.recentAssessments) {
      els.recentAssessments.innerHTML = '';
      const recent = state.assessments.slice(0, 4);
      if (recent.length === 0) {
        els.recentAssessments.innerHTML = '<p class="text-fg-3 small mb-0">No assessments yet.</p>';
      } else {
        recent.forEach(a => {
          const item = document.createElement('div');
          item.className = 'glass p-2 rounded mb-2';
          item.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
              <div>
                <div class="fw-semibold">${a.title || a.vendorName}</div>
                <div class="text-fg-3 small">${a.vendorName} • ${a.state || 'draft'}</div>
              </div>
              <span class="badge-soft">${a.templateVersion ? `v${a.templateVersion}` : 'Assessment'}</span>
            </div>`;
          item.addEventListener('click', () => selectAssessment(a));
          els.recentAssessments.appendChild(item);
        });
      }
    }
  }

  function renderAssessmentList(container, assessments) {
    if (!container) return;
    container.innerHTML = '';
    if (!assessments || assessments.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'text-fg-3 small';
      empty.textContent = 'No assessments yet.';
      container.appendChild(empty);
      return;
    }

    assessments.forEach(a => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-start gap-2';
      btn.innerHTML = `
        <div>
          <div class="fw-semibold">${a.title || a.vendorName}</div>
          <div class="text-fg-3 small">${a.vendorName} • ${a.state || 'draft'}</div>
        </div>
        <div class="text-end text-fg-3 small">
          <div>${new Date(a.updatedAt || a.createdAt || Date.now()).toLocaleDateString()}</div>
          <span class="badge-soft">${(a.tags || []).slice(0, 2).join(', ') || 'ValueSphere'}</span>
        </div>`;
      btn.addEventListener('click', () => selectAssessment(a));
      container.appendChild(btn);
    });
  }

  function renderAssessmentDetail() {
    if (!els.assessmentDetail) return;
    const a = state.selectedAssessment;
    if (!a) {
      els.assessmentDetail.classList.add('d-none');
      if (els.assessmentEmpty) els.assessmentEmpty.classList.remove('d-none');
      return;
    }

    els.assessmentDetail.classList.remove('d-none');
    if (els.assessmentEmpty) els.assessmentEmpty.classList.add('d-none');

    if (els.assessmentTitle) els.assessmentTitle.textContent = a.title || 'Assessment';
    if (els.assessmentVendor) els.assessmentVendor.textContent = a.vendorName || 'Vendor';
    if (els.assessmentState) els.assessmentState.textContent = (a.state || 'draft').toUpperCase();
    if (els.assessmentSummary) els.assessmentSummary.textContent = a.summary || 'No summary provided.';
    if (els.assessmentTags) els.assessmentTags.textContent = (a.tags || []).join(', ') || 'No tags';
    if (els.assessmentMeta) {
      const updated = new Date(a.updatedAt || a.createdAt || Date.now()).toLocaleString();
      els.assessmentMeta.textContent = `Last updated ${updated}`;
    }

    if (els.assessmentCriteria) {
      els.assessmentCriteria.innerHTML = '';
      const criteria = Array.isArray(a.criteria) ? a.criteria : [];
      if (criteria.length === 0) {
        els.assessmentCriteria.innerHTML = '<p class="text-fg-3 small mb-0">No criteria captured.</p>';
      } else {
        criteria.forEach(c => {
          const row = document.createElement('div');
          row.className = 'glass p-2 rounded mb-2';
          row.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
              <div>
                <div class="fw-semibold">${c.questionId || 'Criteria'}</div>
                <div class="text-fg-3 small">Section: ${c.sectionId || 'N/A'}</div>
              </div>
              <div class="text-end">
                <div class="text-fg-2 small">Score: ${c.score ?? '-'}</div>
                <div class="text-fg-3 small">Weight: ${c.weight ?? '-'}</div>
              </div>
            </div>`;
          els.assessmentCriteria.appendChild(row);
        });
      }
    }

    if (els.assessmentScoring) {
      els.assessmentScoring.innerHTML = '';
      const scoring = a.scoring || {};
      const summary = document.createElement('div');
      summary.className = 'glass p-2 rounded';
      summary.innerHTML = `
        <div class="d-flex justify-content-between">
          <span>Total score</span>
          <strong>${scoring.totalScore ?? '—'}</strong>
        </div>
        <div class="text-fg-3 small">Model: ${scoring.model || 'Weighted criteria'}</div>`;
      els.assessmentScoring.appendChild(summary);
    }

    if (els.assessmentStakeholders) {
      els.assessmentStakeholders.innerHTML = '';
      const stakeholders = Array.isArray(a.stakeholders) ? a.stakeholders : [];
      if (stakeholders.length === 0) {
        els.assessmentStakeholders.innerHTML = '<p class="text-fg-3 small mb-0">No stakeholders recorded.</p>';
      } else {
        stakeholders.forEach(s => {
          const item = document.createElement('div');
          item.className = 'glass p-2 rounded mb-2';
          item.innerHTML = `
            <div class="fw-semibold">${s.name || 'Stakeholder'}</div>
            <div class="text-fg-3 small">${s.role || 'Role'} • Influence: ${s.influence || 'n/a'}</div>`;
          els.assessmentStakeholders.appendChild(item);
        });
      }
    }
  }

  function selectAssessment(assessment) {
    state.selectedAssessment = assessment;
    renderAssessmentDetail();
  }

  async function loadTemplates() {
    try {
      const mode = state.context?.activePersona === 'buyer' ? 'buyer' : 'seller';
      const data = await fetchJson(`/api/valuesphere/templates?mode=${encodeURIComponent(mode)}`);
      state.templates = Array.isArray(data.templates) ? data.templates : [];
      renderTemplates();
      renderOverview();
      populateTemplateSelect();
    } catch (err) {
      if (els.templateLibraryError) {
        els.templateLibraryError.textContent = err.message;
        els.templateLibraryError.classList.remove('d-none');
      }
    }
  }

  async function loadAssessments() {
    try {
      const data = await fetchJson('/api/valuesphere/buyer/assessments');
      state.assessments = Array.isArray(data.assessments) ? data.assessments : [];
      renderOverview();
      renderAssessmentList(els.assessmentList, state.assessments.filter(a => a.state !== 'locked'));
      if (els.completedAssessments) {
        const completed = state.assessments.filter(a => a.state === 'locked');
        renderAssessmentList(els.completedAssessments, completed);
      }
      if (!state.selectedAssessment && state.assessments.length > 0) {
        selectAssessment(state.assessments[0]);
      }
    } catch (err) {
      showStatus(err.message, 'error');
    }
  }

  function populateTemplateSelect() {
    if (!els.assessmentTemplateSelect) return;
    els.assessmentTemplateSelect.innerHTML = '<option value="">Select template (optional)</option>';
    state.templates.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = `${t.name} (v${t.versionNumber || 1})`;
      els.assessmentTemplateSelect.appendChild(opt);
    });
  }

  async function handleTemplateSubmit(event) {
    event.preventDefault();
    if (!els.templateForm) return;
    const formData = new FormData(els.templateForm);
    const name = formData.get('templateName')?.toString().trim();
    const description = formData.get('templateDescription')?.toString().trim();
    const changeSummary = formData.get('templateChangeSummary')?.toString().trim();
    const mode = state.context?.activePersona === 'buyer' ? 'buyer' : 'seller';
    const sections = serialiseTemplateSections();

    if (!name) {
      showStatus('Template name is required.', 'error');
      return;
    }

    try {
      showStatus('Saving template...');
      const payload = { name, description, changeSummary, sections, mode };
      const data = await fetchJson('/api/valuesphere/templates', { method: 'POST', body: JSON.stringify(payload) });
      showStatus('Template created.', 'success');
      state.templates.unshift(data.template);
      renderTemplates();
      renderOverview();
      populateTemplateSelect();
      els.templateForm.reset();
      if (els.templateSections) els.templateSections.innerHTML = '';
      addInitialSections();
    } catch (err) {
      showStatus(err.message, 'error');
    }
  }

  async function handleAssessmentSubmit(event) {
    event.preventDefault();
    if (!els.assessmentCreateForm) return;
    const formData = new FormData(els.assessmentCreateForm);
    const vendorName = formData.get('vendorName')?.toString().trim();
    const title = formData.get('assessmentTitleInput')?.toString().trim();
    const summary = formData.get('assessmentSummaryInput')?.toString().trim();
    const tags = formData.get('assessmentTags')?.toString().split(',').map(t => t.trim()).filter(Boolean) || [];
    const templateId = formData.get('templateId')?.toString().trim();

    if (!vendorName) {
      showStatus('Vendor name is required.', 'error');
      return;
    }

    try {
      showStatus('Creating assessment...');
      const payload = { vendorName, title, summary, tags, templateId: templateId || undefined };
      const data = await fetchJson('/api/valuesphere/buyer/assessments', { method: 'POST', body: JSON.stringify(payload) });
      showStatus('Assessment created.', 'success');
      state.assessments.unshift(data.assessment);
      renderOverview();
      renderAssessmentList(els.assessmentList, state.assessments.filter(a => a.state !== 'locked'));
      if (!state.selectedAssessment) selectAssessment(data.assessment);
      els.assessmentCreateForm.reset();
    } catch (err) {
      showStatus(err.message, 'error');
    }
  }

  async function transitionAssessment(stateTarget) {
    if (!state.selectedAssessment) return;
    try {
      showStatus(`Updating assessment to ${stateTarget}...`);
      const data = await fetchJson(`/api/valuesphere/buyer/assessments/${state.selectedAssessment.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ state: stateTarget })
      });
      const updated = data.assessment;
      state.assessments = state.assessments.map(a => (a.id === updated.id ? updated : a));
      state.selectedAssessment = updated;
      renderOverview();
      renderAssessmentList(els.assessmentList, state.assessments.filter(a => a.state !== 'locked'));
      if (els.completedAssessments) {
        const completed = state.assessments.filter(a => a.state === 'locked');
        renderAssessmentList(els.completedAssessments, completed);
      }
      renderAssessmentDetail();
      showStatus('Assessment updated.', 'success');
    } catch (err) {
      showStatus(err.message, 'error');
    }
  }

  function addInitialSections() {
    if (!els.templateSections) return;
    if (els.templateSections.childElementCount === 0) {
      els.templateSections.appendChild(createSectionCard());
    }
  }

  async function loadContext() {
    try {
      const ctx = await fetchJson('/api/me/context');
      state.context = ctx;
      applyTheme(ctx);
    } catch (err) {
      showStatus(err.message, 'error');
    }
  }

  function bindEvents() {
    if (els.addSectionBtn && els.templateSections) {
      els.addSectionBtn.addEventListener('click', () => {
        els.templateSections.appendChild(createSectionCard());
      });
    }

    if (els.templateForm) {
      els.templateForm.addEventListener('submit', handleTemplateSubmit);
    }

    if (els.assessmentCreateForm) {
      els.assessmentCreateForm.addEventListener('submit', handleAssessmentSubmit);
    }

    if (els.transitionShared) {
      els.transitionShared.addEventListener('click', () => transitionAssessment('shared'));
    }
    if (els.transitionAgreed) {
      els.transitionAgreed.addEventListener('click', () => transitionAssessment('agreed'));
    }
    if (els.transitionLocked) {
      els.transitionLocked.addEventListener('click', () => transitionAssessment('locked'));
    }
  }

  async function init() {
    bindEvents();
    addInitialSections();
    await loadContext();
    await loadTemplates();
    await loadAssessments();
    renderAssessmentDetail();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
