import { initPage } from './app.js';
import { apiRequest } from './api.js';

function escapeHtml(value = '') {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatListDisplay(value = []) {
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  if (typeof value === 'string') {
    return value;
  }
  return '';
}

function parseListInput(value = '') {
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

document.addEventListener('DOMContentLoaded', async () => {
  const user = await initPage('roadmap');
  const projectSelect = document.querySelector('[data-project-select]');
  const targetsField = document.querySelector('[data-targets]');
  const statusEl = document.querySelector('[data-roadmap-status]');
  const initiativesContainer = document.querySelector('[data-initiatives]');
  const generateBtn = document.querySelector('[data-generate]');
  const saveBtn = document.querySelector('[data-save]');
  const addBtn = document.querySelector('[data-add-initiative]');

  if (!user) {
    if (projectSelect) projectSelect.disabled = true;
    if (generateBtn) generateBtn.disabled = true;
    if (saveBtn) saveBtn.disabled = true;
    if (addBtn) addBtn.disabled = true;
    if (initiativesContainer) initiativesContainer.innerHTML = '<div class="text-center text-fg-3">Sign in to manage roadmaps.</div>';
    return;
  }

  let projects = [];
  let roadmaps = [];
  let currentRoadmap = null;
  let workingInitiatives = [];

  setStatus('Loading projects…');

  function setStatus(message, tone = 'muted') {
    if (!statusEl) return;
    const toneClass =
      tone === 'success'
        ? 'text-success'
        : tone === 'danger'
        ? 'text-danger'
        : tone === 'warning'
        ? 'text-warning'
        : 'text-fg-3';
    statusEl.className = `small ${toneClass}`;
    statusEl.textContent = message;
  }

  function getProjectIdForRoadmap(roadmap) {
    if (!roadmap) return null;
    if (typeof roadmap.project === 'string') return roadmap.project;
    if (roadmap.project && typeof roadmap.project === 'object') {
      return roadmap.project._id || roadmap.project.id || null;
    }
    return null;
  }

  function ensureProjectSelected() {
    if (!projectSelect?.value) {
      setStatus('Select a project first.', 'warning');
      return false;
    }
    return true;
  }

  function upsertRoadmap(roadmap) {
    const projectId = getProjectIdForRoadmap(roadmap);
    roadmaps = roadmaps.filter(item => getProjectIdForRoadmap(item) !== projectId);
    roadmaps.push(roadmap);
    return projectId;
  }

  async function loadProjects() {
    if (!projectSelect) return;
    try {
      const data = await apiRequest('/api/projects');
      projects = data.projects || [];
      projectSelect.innerHTML = '<option value="">Select project…</option>';
      projects.forEach(project => {
        const option = document.createElement('option');
        option.value = project._id;
        option.textContent = project.name;
        projectSelect.appendChild(option);
      });
      if (!projects.length) {
        setStatus('Create a project to begin building a roadmap.');
      }
    } catch (error) {
      setStatus(error.payload?.error || 'Unable to load projects', 'danger');
    }
  }

  async function loadRoadmaps() {
    try {
      const data = await apiRequest('/api/roadmaps');
      roadmaps = data.roadmaps || [];
    } catch (error) {
      setStatus(error.payload?.error || 'Unable to load roadmaps', 'danger');
    }
  }

  function getProjectName(id) {
    return projects.find(project => project._id === id)?.name || 'Project';
  }

  function selectRoadmap(projectId, options = {}) {
    if (!projectId) {
      currentRoadmap = null;
      workingInitiatives = [];
      renderInitiatives();
      setStatus(options.statusMessage || 'Select a project to begin.', options.statusTone);
      return;
    }
    currentRoadmap =
      roadmaps.find(item => getProjectIdForRoadmap(item) === projectId) || null;
    workingInitiatives = currentRoadmap
      ? JSON.parse(JSON.stringify(currentRoadmap.initiatives || []))
      : [];
    renderInitiatives();
    if (options.statusMessage) {
      setStatus(options.statusMessage, options.statusTone);
      return;
    }
    setStatus(
      currentRoadmap
        ? `Loaded roadmap for ${getProjectName(projectId)}.`
        : 'No roadmap yet. Generate one from targets or add initiatives manually.'
    );
  }

  function renderInitiatives() {
    initiativesContainer.innerHTML = '';
    if (!workingInitiatives.length) {
      initiativesContainer.innerHTML = '<div class="text-fg-3 small">No initiatives defined.</div>';
      return;
    }
    workingInitiatives.forEach((initiative, index) => {
      const card = document.createElement('div');
      card.className = 'card bg-surface border-0 p-3';
      card.draggable = true;
      card.dataset.index = index;
      const startDate = initiative.start ? initiative.start.substring(0, 10) : '';
      const endDate = initiative.end ? initiative.end.substring(0, 10) : '';
      card.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h3 class="h6 mb-0">${escapeHtml(initiative.title || 'Untitled initiative')}</h3>
          <span class="badge bg-secondary">${escapeHtml(initiative.owner || 'Owner TBD')}</span>
        </div>
        <div class="row g-2 mb-2">
          <div class="col-md-6">
            <label class="d-grid gap-1">
              <span class="text-fg-3 small">Title</span>
              <input class="form-control bg-surface text-fg" value="${escapeHtml(initiative.title || '')}" data-field="title" />
            </label>
          </div>
          <div class="col-md-6">
            <label class="d-grid gap-1">
              <span class="text-fg-3 small">Owner</span>
              <input class="form-control bg-surface text-fg" value="${escapeHtml(initiative.owner || '')}" data-field="owner" />
            </label>
          </div>
        </div>
        <div class="row g-2 mb-2">
          <div class="col-md-6">
            <label class="d-grid gap-1">
              <span class="text-fg-3 small">Start</span>
              <input class="form-control bg-surface text-fg" type="date" value="${escapeHtml(startDate)}" data-field="start" />
            </label>
          </div>
          <div class="col-md-6">
            <label class="d-grid gap-1">
              <span class="text-fg-3 small">End</span>
              <input class="form-control bg-surface text-fg" type="date" value="${escapeHtml(endDate)}" data-field="end" />
            </label>
          </div>
        </div>
        <label class="d-grid gap-1 mb-2">
          <span class="text-fg-3 small">Description</span>
          <textarea class="form-control bg-surface text-fg" rows="2" data-field="description">${escapeHtml(initiative.description || '')}</textarea>
        </label>
        <div class="row g-2 mb-2">
          <div class="col-md-6">
            <label class="d-grid gap-1">
              <span class="text-fg-3 small">Dependencies</span>
              <input class="form-control bg-surface text-fg" value="${escapeHtml(formatListDisplay(initiative.deps))}" data-field="deps" data-format="array" placeholder="Comma separated" />
            </label>
          </div>
          <div class="col-md-6">
            <label class="d-grid gap-1">
              <span class="text-fg-3 small">Risk</span>
              <input class="form-control bg-surface text-fg" value="${escapeHtml(initiative.risk || '')}" data-field="risk" />
            </label>
          </div>
        </div>
        <label class="d-grid gap-1 mb-2">
          <span class="text-fg-3 small">KPIs</span>
          <input class="form-control bg-surface text-fg" value="${escapeHtml(formatListDisplay(initiative.kpis))}" data-field="kpis" data-format="array" placeholder="Comma separated" />
        </label>
        <div class="d-flex gap-2">
          <button class="btn btn-outline-light btn-sm" type="button" data-action="remove">Remove</button>
        </div>
      `;
      initiativesContainer.appendChild(card);
    });
  }

  initiativesContainer.addEventListener('input', event => {
    const card = event.target.closest('.card');
    if (!card) return;
    const index = Number(card.dataset.index);
    const field = event.target.dataset.field;
    if (!field) return;
    const format = event.target.dataset.format;
    let value = event.target.value;
    if (format === 'array') {
      value = parseListInput(value);
    }
    workingInitiatives[index] = { ...workingInitiatives[index], [field]: value };
  });

  initiativesContainer.addEventListener('click', event => {
    if (event.target.dataset.action === 'remove') {
      const card = event.target.closest('.card');
      const index = Number(card.dataset.index);
      workingInitiatives.splice(index, 1);
      renderInitiatives();
    }
  });

  let dragIndex = null;
  initiativesContainer.addEventListener('dragstart', event => {
    const card = event.target.closest('.card');
    if (!card) return;
    dragIndex = Number(card.dataset.index);
    event.dataTransfer.effectAllowed = 'move';
  });
  initiativesContainer.addEventListener('dragover', event => {
    event.preventDefault();
  });
  initiativesContainer.addEventListener('drop', event => {
    event.preventDefault();
    const card = event.target.closest('.card');
    if (!card || dragIndex === null) return;
    const dropIndex = Number(card.dataset.index);
    if (dropIndex === dragIndex) {
      dragIndex = null;
      return;
    }
    const [moved] = workingInitiatives.splice(dragIndex, 1);
    workingInitiatives.splice(dropIndex, 0, moved);
    renderInitiatives();
    dragIndex = null;
  });

  initiativesContainer.addEventListener('dragend', () => {
    dragIndex = null;
  });

  addBtn?.addEventListener('click', () => {
    if (!ensureProjectSelected()) return;
    workingInitiatives.push({
      id: `initiative-${Date.now()}`,
      title: 'New initiative',
      description: '',
      owner: '',
      start: '',
      end: '',
      deps: [],
      risk: '',
      kpis: []
    });
    renderInitiatives();
  });

  generateBtn?.addEventListener('click', async () => {
    if (!ensureProjectSelected()) return;
    const targetsRaw = targetsField?.value || '';
    const targets = targetsRaw
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map((line, index) => ({ title: line, description: line, id: `target-${index}` }));
    setStatus('Generating roadmap…');
    try {
      const { roadmap } = await apiRequest('/api/roadmaps', {
        method: 'POST',
        body: { projectId: projectSelect.value, targets, generate: true }
      });
      upsertRoadmap(roadmap);
      currentRoadmap = roadmap;
      workingInitiatives = JSON.parse(JSON.stringify(roadmap.initiatives || []));
      renderInitiatives();
      setStatus('Roadmap generated.', 'success');
    } catch (err) {
      setStatus(err.payload?.error || 'Unable to generate roadmap', 'danger');
    }
  });

  saveBtn?.addEventListener('click', async () => {
    if (!ensureProjectSelected()) return;
    setStatus('Saving roadmap…');
    try {
      if (currentRoadmap) {
        const { roadmap } = await apiRequest(`/api/roadmaps/${currentRoadmap._id}`, {
          method: 'PUT',
          body: { initiatives: workingInitiatives }
        });
        upsertRoadmap(roadmap);
        currentRoadmap = roadmap;
        workingInitiatives = JSON.parse(JSON.stringify(roadmap.initiatives || []));
        renderInitiatives();
        setStatus('Roadmap updated.', 'success');
      } else {
        const { roadmap } = await apiRequest('/api/roadmaps', {
          method: 'POST',
          body: { projectId: projectSelect.value, initiatives: workingInitiatives }
        });
        upsertRoadmap(roadmap);
        currentRoadmap = roadmap;
        workingInitiatives = JSON.parse(JSON.stringify(roadmap.initiatives || []));
        renderInitiatives();
        setStatus('Roadmap created.', 'success');
      }
    } catch (err) {
      setStatus(err.payload?.error || 'Unable to save roadmap', 'danger');
    }
  });

  projectSelect?.addEventListener('change', () => {
    selectRoadmap(projectSelect.value);
  });

  await loadProjects();
  await loadRoadmaps();
  if (projects.length) {
    projectSelect.value = projects[0]._id;
    selectRoadmap(projectSelect.value);
  }
});
