const projectSelect = document.getElementById('comparison-project');
const rfxSelect = document.getElementById('comparison-rfx');
const vendorContainer = document.getElementById('comparison-vendors');
const comparisonForm = document.getElementById('comparison-form');
const methodSelect = document.getElementById('comparison-method');
const summaryContainer = document.getElementById('comparison-summary');

const state = {
  projects: [],
  rfx: [],
  vendorResponses: [],
  sections: []
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

const loadRfx = async (projectId) => {
  try {
    const { rfx } = await fetchJson('/api/rfx');
    state.rfx = (rfx || []).filter((entry) => entry.projectId === projectId);
    rfxSelect.innerHTML = '<option value="">Select RFX</option>';
    state.rfx.forEach((entry) => {
      const option = document.createElement('option');
      option.value = entry._id;
      option.textContent = entry.title;
      rfxSelect.appendChild(option);
    });
  } catch (err) {
    console.error('Failed to load RFX', err);
  }
};

const loadVendorResponses = async (rfxId) => {
  try {
    const { responses } = await fetchJson('/api/vendor-responses');
    state.vendorResponses = (responses || []).filter((response) => response.rfxId === rfxId);
    vendorContainer.innerHTML = '';
    if (state.vendorResponses.length === 0) {
      vendorContainer.innerHTML = '<div class="glass p-3">No vendor responses submitted yet.</div>';
      return;
    }
    state.vendorResponses.forEach((response) => {
      const label = document.createElement('label');
      label.className = 'd-flex align-items-center gap-2 glass p-3';
      const vendorId = (response.vendorId || '').toString();
      label.innerHTML = `
        <input type="checkbox" value="${vendorId}" checked />
        <div>
          <div class="fw-semibold">Vendor ${vendorId}</div>
          <div class="text-fg-3">Autoscore: ${(response.autoscore?.overall || 0).toFixed(2)}</div>
        </div>
      `;
      vendorContainer.appendChild(label);
    });
  } catch (err) {
    console.error('Failed to load vendor responses', err);
  }
};

const loadSections = async (rfxId) => {
  try {
    const { rfx } = await fetchJson(`/api/rfx/${rfxId}`);
    state.sections = rfx.sections || [];
  } catch (err) {
    console.error('Failed to load RFX detail', err);
  }
};

projectSelect?.addEventListener('change', () => {
  const projectId = projectSelect.value;
  if (!projectId) return;
  loadRfx(projectId);
  vendorContainer.innerHTML = '';
  rfxSelect.innerHTML = '<option value="">Select RFX</option>';
});

rfxSelect?.addEventListener('change', () => {
  const rfxId = rfxSelect.value;
  if (!rfxId) return;
  loadVendorResponses(rfxId);
  loadSections(rfxId);
});

comparisonForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const rfxId = rfxSelect.value;
  if (!rfxId) return;
  const vendorIds = Array.from(vendorContainer.querySelectorAll('input[type="checkbox"]'))
    .filter((input) => input.checked)
    .map((input) => input.value);
  const weights = {};
  state.sections.forEach((section) => {
    weights[section.id] = section.weight || 1;
  });
  try {
    const res = await fetch('/api/comparisons', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rfxId, method: methodSelect.value, weights, vendorIds })
    });
    if (!res.ok) throw new Error('Comparison failed');
    const { comparison } = await res.json();
    summaryContainer.hidden = false;
    summaryContainer.innerHTML = `
      <div class="glass p-4">
        <h2 class="h5 mb-2">Comparison created</h2>
        <p class="text-fg-3 mb-1">Method: ${comparison.method}</p>
        <p class="text-fg-3 mb-1">Vendors ranked: ${(comparison.results || []).length}</p>
        <a class="btn btn-outline-light" href="project.html?id=${projectSelect.value}">View project insights</a>
      </div>
    `;
  } catch (err) {
    console.error(err);
  }
});

loadProjects();
