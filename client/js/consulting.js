const projectSelect = document.getElementById('session-project');
const sessionForm = document.getElementById('session-form');
const historyContainer = document.getElementById('session-history');
const copilotContainer = document.getElementById('session-copilot');

const state = {
  projects: [],
  sessions: []
};

const fetchJson = async (url, options = {}) => {
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  if (!res.ok) {
    throw new Error('Request failed');
  }
  return res.json();
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

const renderSessions = () => {
  historyContainer.innerHTML = '';
  if (!state.sessions.length) {
    historyContainer.innerHTML =
      '<div class="glass p-4">No sessions logged yet.</div>';
    copilotContainer.innerHTML = '';
    return;
  }
  state.sessions.forEach((session) => {
    const card = document.createElement('div');
    card.className = 'glass p-4';
    card.innerHTML = `
      <div class="d-flex justify-content-between align-items-start mb-2">
        <h3 class="h6 mb-0">${new Date(session.date).toLocaleDateString()}</h3>
        <span class="text-fg-3">${session.actions?.length || 0} actions</span>
      </div>
      <p class="text-fg-3 mb-2">${session.notes || 'No notes captured.'}</p>
      <div class="text-fg-3"><strong>Decisions:</strong> ${(session.decisions || []).join(', ') || '—'}</div>
      <div class="text-fg-3"><strong>Risks:</strong> ${(session.risks || []).join(', ') || '—'}</div>
      <div class="text-fg-3"><strong>Actions:</strong> ${(session.actions || []).join(', ') || '—'}</div>
    `;
    historyContainer.appendChild(card);
  });
  const latest = state.sessions[0];
  copilotContainer.innerHTML = `
    <div class="glass p-3">
      <h3 class="h6 mb-1">Latest decisions</h3>
      <p class="text-fg-3 mb-0">${(latest.decisions || []).join(', ') || 'No decisions captured.'}</p>
    </div>
    <div class="glass p-3">
      <h3 class="h6 mb-1">Risks</h3>
      <p class="text-fg-3 mb-0">${(latest.risks || []).join(', ') || 'No risks logged.'}</p>
    </div>
    <div class="glass p-3">
      <h3 class="h6 mb-1">Actions</h3>
      <p class="text-fg-3 mb-0">${(latest.actions || []).join(', ') || 'No actions available.'}</p>
    </div>
  `;
};

const loadSessions = async (projectId) => {
  try {
    const { sessions } = await fetchJson(
      `/api/consulting-sessions?projectId=${projectId}`
    );
    state.sessions = (sessions || []).sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );
    renderSessions();
  } catch (err) {
    console.error('Failed to load sessions', err);
  }
};

projectSelect?.addEventListener('change', () => {
  const projectId = projectSelect.value;
  if (projectId) {
    loadSessions(projectId);
  }
});

sessionForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const projectId = projectSelect.value;
  if (!projectId) return;
  const payload = {
    projectId,
    date: sessionForm.querySelector('#session-date').value,
    notes: sessionForm.querySelector('#session-notes').value
  };
  try {
    await fetch('/api/consulting-sessions', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    sessionForm.reset();
    loadSessions(projectId);
  } catch (err) {
    console.error('Failed to save session', err);
  }
});

loadProjects();
