const projectSelect = document.getElementById('roadmap-project');
const initiativesContainer = document.getElementById('roadmap-initiatives');
const generateButton = document.getElementById('generate-roadmap');
const saveButton = document.getElementById('save-roadmap');
const copilotContainer = document.getElementById('roadmap-copilot');
const refreshCopilotButton = document.getElementById('refresh-roadmap-copilot');

const state = {
  projects: [],
  roadmap: null
};

const fetchJson = async (url, options = {}) => {
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  if (!res.ok) throw new Error('Request failed');
  return res.json();
};

const renderInitiatives = () => {
  initiativesContainer.innerHTML = '';
  if (!state.roadmap || (state.roadmap.initiatives || []).length === 0) {
    initiativesContainer.innerHTML = '<div class="glass p-4">No initiatives yet. Generate from assessments or add manually.</div>';
    return;
  }
  state.roadmap.initiatives.forEach((initiative, index) => {
    const card = document.createElement('div');
    card.className = 'glass p-4';
    card.innerHTML = `
      <div class="d-flex justify-content-between align-items-start mb-3">
        <h3 class="h6 mb-0">Initiative ${index + 1}</h3>
        <button class="btn btn-outline-light btn-sm" data-remove="${initiative.id}">Remove</button>
      </div>
      <div class="d-grid gap-3">
        <div>
          <label class="form-label" for="initiative-title-${initiative.id}">Title</label>
          <input class="form-control" id="initiative-title-${initiative.id}" value="${initiative.title}" />
        </div>
        <div>
          <label class="form-label" for="initiative-desc-${initiative.id}">Description</label>
          <textarea class="form-control" id="initiative-desc-${initiative.id}" rows="3">${initiative.description || ''}</textarea>
        </div>
        <div class="row g-3">
          <div class="col-md-4">
            <label class="form-label" for="initiative-owner-${initiative.id}">Owner</label>
            <input class="form-control" id="initiative-owner-${initiative.id}" value="${initiative.owner || ''}" />
          </div>
          <div class="col-md-4">
            <label class="form-label" for="initiative-start-${initiative.id}">Start</label>
            <input class="form-control" id="initiative-start-${initiative.id}" type="date" value="${
              initiative.start ? new Date(initiative.start).toISOString().slice(0, 10) : ''
            }" />
          </div>
          <div class="col-md-4">
            <label class="form-label" for="initiative-end-${initiative.id}">End</label>
            <input class="form-control" id="initiative-end-${initiative.id}" type="date" value="${
              initiative.end ? new Date(initiative.end).toISOString().slice(0, 10) : ''
            }" />
          </div>
        </div>
        <div class="row g-3">
          <div class="col-md-6">
            <label class="form-label" for="initiative-risk-${initiative.id}">Risk</label>
            <input class="form-control" id="initiative-risk-${initiative.id}" value="${initiative.risk || ''}" />
          </div>
          <div class="col-md-6">
            <label class="form-label" for="initiative-kpi-${initiative.id}">KPIs (comma separated)</label>
            <input class="form-control" id="initiative-kpi-${initiative.id}" value="${(initiative.kpis || []).join(', ')}" />
          </div>
        </div>
      </div>
    `;
    initiativesContainer.appendChild(card);

    card.querySelector(`#initiative-title-${initiative.id}`).addEventListener('input', (event) => {
      initiative.title = event.target.value;
    });
    card.querySelector(`#initiative-desc-${initiative.id}`).addEventListener('input', (event) => {
      initiative.description = event.target.value;
    });
    card.querySelector(`#initiative-owner-${initiative.id}`).addEventListener('input', (event) => {
      initiative.owner = event.target.value;
    });
    card.querySelector(`#initiative-start-${initiative.id}`).addEventListener('change', (event) => {
      initiative.start = event.target.value ? new Date(event.target.value).toISOString() : null;
    });
    card.querySelector(`#initiative-end-${initiative.id}`).addEventListener('change', (event) => {
      initiative.end = event.target.value ? new Date(event.target.value).toISOString() : null;
    });
    card.querySelector(`#initiative-risk-${initiative.id}`).addEventListener('input', (event) => {
      initiative.risk = event.target.value;
    });
    card.querySelector(`#initiative-kpi-${initiative.id}`).addEventListener('input', (event) => {
      initiative.kpis = event.target.value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
    });
    card.querySelector(`[data-remove="${initiative.id}"]`).addEventListener('click', () => {
      state.roadmap.initiatives.splice(index, 1);
      renderInitiatives();
    });
  });
};

const loadProjects = async () => {
  try {
    const { projects } = await fetchJson('/api/projects');
    state.projects = projects || [];
    projectSelect.innerHTML = '<option value="">Select project</option>';
    state.projects.forEach((project) => {
      const option = document.createElement('option');
      option.value = project._id;
      option.textContent = project.name;
      projectSelect.appendChild(option);
    });
  } catch (err) {
    console.error('Failed to load projects', err);
  }
};

const loadRoadmap = async (projectId) => {
  try {
    const { roadmap } = await fetchJson(`/api/roadmaps/project/${projectId}`);
    state.roadmap = roadmap || { projectId, initiatives: [] };
    renderInitiatives();
  } catch (err) {
    console.error('Failed to load roadmap', err);
  }
};

projectSelect?.addEventListener('change', () => {
  const projectId = projectSelect.value;
  if (!projectId) return;
  loadRoadmap(projectId);
  loadCopilot(projectId);
});

const generateRoadmap = async () => {
  const projectId = projectSelect.value;
  if (!projectId) return;
  try {
    const { roadmap } = await fetchJson('/api/roadmaps/create-from-assessments', {
      method: 'POST',
      body: JSON.stringify({ projectId, targets: {} })
    });
    state.roadmap = roadmap;
    renderInitiatives();
    loadCopilot(projectId);
  } catch (err) {
    console.error('Failed to generate roadmap', err);
  }
};

generateButton?.addEventListener('click', generateRoadmap);

const saveRoadmap = async () => {
  const projectId = projectSelect.value;
  if (!projectId) return;
  try {
    const payload = {
      projectId,
      initiatives: state.roadmap?.initiatives || []
    };
    if (state.roadmap?._id) {
      await fetch(`/api/roadmaps/${state.roadmap._id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      const { roadmap } = await fetchJson('/api/roadmaps/create-from-assessments', {
        method: 'POST',
        body: JSON.stringify({ projectId, targets: {}, initiatives: payload.initiatives })
      });
      state.roadmap = roadmap;
    }
  } catch (err) {
    console.error('Failed to save roadmap', err);
  }
};

saveButton?.addEventListener('click', saveRoadmap);

const loadCopilot = async (projectId) => {
  if (!projectId) return;
  copilotContainer.innerHTML = '<p class="text-fg-3">Gathering insights…</p>';
  try {
    const { roadmap } = await fetchJson('/api/ai/roadmaps/compose', {
      method: 'POST',
      body: JSON.stringify({ projectId, targets: {} })
    });
    const initiatives = roadmap?.initiatives || [];
    if (initiatives.length === 0) {
      copilotContainer.innerHTML = '<p class="text-fg-3">No suggestions yet.</p>';
      return;
    }
    copilotContainer.innerHTML = initiatives
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
    console.error('Failed to load copilot insights', err);
    copilotContainer.innerHTML = '<p class="text-danger">Copilot unavailable.</p>';
  }
};

refreshCopilotButton?.addEventListener('click', () => {
  const projectId = projectSelect.value;
  if (projectId) loadCopilot(projectId);
});

loadProjects();
