const params = new URLSearchParams(window.location.search);
const projectId = params.get('id');

const elements = {
  name: document.getElementById('project-name'),
  purpose: document.getElementById('project-purpose'),
  tags: document.getElementById('project-tags'),
  meta: document.getElementById('project-meta'),
  assessmentList: document.getElementById('assessment-list'),
  rfxList: document.getElementById('rfx-list'),
  comparisonList: document.getElementById('comparison-list'),
  roadmapSummary: document.getElementById('roadmap-summary'),
  sessionList: document.getElementById('session-list'),
  settingsForm: document.getElementById('project-settings-form'),
  settingsFeedback: document.getElementById('settings-feedback'),
  copilot: document.getElementById('copilot-suggestions'),
  refreshCopilot: document.getElementById('refresh-copilot'),
  tabs: document.getElementById('project-tabs')
};

if (!projectId) {
  elements.name && (elements.name.textContent = 'Project not found');
}

const fetchJSON = async (url, options = {}) => {
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  if (!res.ok) {
    throw new Error(`Failed request: ${url}`);
  }
  return res.json();
};

const loadProject = async () => {
  try {
    const { project } = await fetchJSON(`/api/projects/${projectId}`);
    elements.name.textContent = project.name;
    elements.purpose.textContent = project.purpose || 'No summary provided yet.';
    elements.tags.innerHTML = (project.tags || [])
      .map((tag) => `<span class="badge bg-secondary text-uppercase">${tag}</span>`)
      .join('');
    const metaHtml = `
      <dt class="col-5 text-fg-3">Organisation</dt>
      <dd class="col-7">${project.orgId || '—'}</dd>
      <dt class="col-5 text-fg-3">Business Unit</dt>
      <dd class="col-7">${project.buId || '—'}</dd>
      <dt class="col-5 text-fg-3">Created</dt>
      <dd class="col-7">${new Date(project.createdAt || Date.now()).toLocaleDateString()}</dd>
    `;
    elements.meta.innerHTML = metaHtml;
    if (elements.settingsForm) {
      elements.settingsForm.elements['name'].value = project.name;
      elements.settingsForm.elements['purpose'].value = project.purpose || '';
    }
  } catch (err) {
    console.error(err);
  }
};

const loadAssessments = async () => {
  if (!elements.assessmentList) return;
  elements.assessmentList.innerHTML = '<p class="text-fg-3">Loading assessments…</p>';
  try {
    const { assessments } = await fetchJSON('/api/assessments');
    const filtered = (assessments || []).filter((item) => item.projectId === projectId);
    if (filtered.length === 0) {
      elements.assessmentList.innerHTML =
        '<div class="glass p-4">No assessments yet. Launch one to benchmark maturity.</div>';
      return;
    }
    elements.assessmentList.innerHTML = filtered
      .map(
        (assessment) => `
          <div class="glass p-4 d-flex justify-content-between align-items-start">
            <div>
              <h3 class="h6 mb-1">${assessment.type}</h3>
              <p class="text-fg-3 mb-0">Overall score: ${(assessment.scores?.overall || 0).toFixed(2)}</p>
            </div>
            <button class="btn btn-outline-light btn-sm" data-assessment="${assessment._id}">View</button>
          </div>
        `
      )
      .join('');
  } catch (err) {
    console.error(err);
    elements.assessmentList.innerHTML = '<p class="text-danger">Unable to load assessments.</p>';
  }
};

const state = {
  rfxIds: []
};

const loadRfx = async () => {
  if (!elements.rfxList) return;
  elements.rfxList.innerHTML = '<p class="text-fg-3">Loading RFX…</p>';
  try {
    const { rfx } = await fetchJSON('/api/rfx');
    const filtered = (rfx || []).filter((item) => item.projectId === projectId);
    state.rfxIds = filtered.map((entry) => entry._id.toString());
    if (filtered.length === 0) {
      elements.rfxList.innerHTML = '<div class="glass p-4">No RFX packages created yet.</div>';
      return;
    }
    elements.rfxList.innerHTML = filtered
      .map(
        (entry) => `
          <div class="glass p-4">
            <h3 class="h6 mb-2">${entry.title}</h3>
            <p class="text-fg-3 mb-2">${entry.sections?.length || 0} sections · ${entry.invitedVendorIds?.length || 0} invited vendors</p>
            <div class="d-flex flex-wrap gap-2">
              ${(entry.sections || []).map((section) => `<span class="badge bg-secondary">${section.title}</span>`).join('')}
            </div>
          </div>
        `
      )
      .join('');
  } catch (err) {
    console.error(err);
    elements.rfxList.innerHTML = '<p class="text-danger">Unable to load RFX data.</p>';
  }
};

const loadComparisons = async () => {
  if (!elements.comparisonList) return;
  elements.comparisonList.innerHTML = '<p class="text-fg-3">Loading comparisons…</p>';
  try {
    const { comparisons } = await fetchJSON('/api/comparisons');
    const filtered = (comparisons || []).filter((entry) => state.rfxIds.includes((entry.rfxId || '').toString()));
    if (filtered.length === 0) {
      elements.comparisonList.innerHTML = '<div class="glass p-4">No comparisons generated yet.</div>';
      return;
    }
    elements.comparisonList.innerHTML = filtered
      .map((entry) => {
        const results = (entry.results || [])
          .map((result) => `<li>Vendor ${result.vendorId}: ${result.score.toFixed(2)} (Rank ${result.rank})</li>`) // eslint-disable-line
          .join('');
        return `
          <div class="glass p-4">
            <h3 class="h6 mb-2">${entry.method}</h3>
            <ul class="text-fg-3 mb-0">${results}</ul>
          </div>
        `;
      })
      .join('');
  } catch (err) {
    console.error(err);
    elements.comparisonList.innerHTML = '<p class="text-danger">Unable to load comparisons.</p>';
  }
};

const loadRoadmap = async () => {
  if (!elements.roadmapSummary) return;
  elements.roadmapSummary.innerHTML = '<p class="text-fg-3">Loading roadmap…</p>';
  try {
    const { roadmap } = await fetchJSON(`/api/roadmaps/project/${projectId}`);
    if (!roadmap || (roadmap.initiatives || []).length === 0) {
      elements.roadmapSummary.innerHTML = '<div class="glass p-4">Roadmap not generated yet.</div>';
      return;
    }
    elements.roadmapSummary.innerHTML = (roadmap.initiatives || [])
      .map(
        (item) => `
          <div class="glass p-4">
            <h3 class="h6 mb-1">${item.title}</h3>
            <p class="text-fg-3 mb-2">${item.description || ''}</p>
            <small class="text-fg-3">${item.start ? new Date(item.start).toLocaleDateString() : 'TBD'} → ${
          item.end ? new Date(item.end).toLocaleDateString() : 'TBD'
        }</small>
          </div>
        `
      )
      .join('');
  } catch (err) {
    console.error(err);
    elements.roadmapSummary.innerHTML = '<p class="text-danger">Unable to load roadmap.</p>';
  }
};

const loadSessions = async () => {
  if (!elements.sessionList) return;
  elements.sessionList.innerHTML = '<p class="text-fg-3">Loading sessions…</p>';
  try {
    const { sessions } = await fetchJSON(`/api/consulting-sessions?projectId=${projectId}`);
    if (!sessions || sessions.length === 0) {
      elements.sessionList.innerHTML = '<div class="glass p-4">No consulting sessions recorded yet.</div>';
      return;
    }
    elements.sessionList.innerHTML = sessions
      .map(
        (session) => `
          <div class="glass p-4">
            <h3 class="h6 mb-1">${new Date(session.date).toLocaleDateString()}</h3>
            <p class="text-fg-3 mb-2">${session.notes || 'No notes captured.'}</p>
            <div class="text-fg-3"><strong>Actions:</strong> ${(session.actions || []).join(', ') || '—'}</div>
          </div>
        `
      )
      .join('');
  } catch (err) {
    console.error(err);
    elements.sessionList.innerHTML = '<p class="text-danger">Unable to load sessions.</p>';
  }
};

const refreshCopilot = async () => {
  if (!elements.copilot) return;
  elements.copilot.innerHTML = '<p class="text-fg-3">Asking Agama Copilot…</p>';
  try {
    const { roadmap } = await fetchJSON('/api/ai/roadmaps/compose', {
      method: 'POST',
      body: JSON.stringify({ projectId, targets: {} })
    });
    const initiatives = roadmap?.initiatives || [];
    if (initiatives.length === 0) {
      elements.copilot.innerHTML = '<p class="text-fg-3">No recommendations yet. Generate an assessment to unlock insights.</p>';
      return;
    }
    elements.copilot.innerHTML = initiatives
      .slice(0, 3)
      .map(
        (initiative) => `
          <div class="glass p-3">
            <h3 class="h6 mb-1">${initiative.title}</h3>
            <p class="text-fg-3 mb-0">${initiative.description || ''}</p>
          </div>
        `
      )
      .join('');
  } catch (err) {
    console.error(err);
    elements.copilot.innerHTML = '<p class="text-danger">Copilot is unavailable right now.</p>';
  }
};

elements.refreshCopilot?.addEventListener('click', () => refreshCopilot());

elements.settingsForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(elements.settingsForm);
  const payload = Object.fromEntries(formData.entries());
  try {
    const res = await fetch(`/api/projects/${projectId}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      throw new Error('Failed to update project');
    }
    elements.settingsFeedback.hidden = false;
    setTimeout(() => (elements.settingsFeedback.hidden = true), 2000);
    loadProject();
  } catch (err) {
    console.error(err);
  }
});

const initTabs = () => {
  if (!elements.tabs) return;
  const buttons = Array.from(elements.tabs.querySelectorAll('button[data-tab]'));
  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const tabName = button.dataset.tab;
      buttons.forEach((btn) => btn.classList.toggle('active', btn === button));
      document.querySelectorAll('.tab-pane').forEach((pane) => {
        pane.hidden = pane.id !== `tab-${tabName}`;
      });
    });
  });
};

const bootstrap = async () => {
  initTabs();
  await loadProject();
  await Promise.all([loadAssessments(), loadRfx(), loadComparisons(), loadRoadmap(), loadSessions()]);
  refreshCopilot();
};

bootstrap();
