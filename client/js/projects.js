const state = {
  projects: [],
  organisations: [],
  businessUnits: {},
  filters: {
    search: '',
    buIds: new Set(),
    tags: new Set()
  }
};

const projectGrid = document.getElementById('project-grid');
const projectEmpty = document.getElementById('project-empty');
const searchInput = document.getElementById('project-search');
const buContainer = document.getElementById('business-unit-filters');
const tagContainer = document.getElementById('project-tag-filters');
const projectFormPanel = document.getElementById('project-form-panel');
const createButton = document.getElementById('create-project-button');
const emptyCreateButton = document.getElementById('empty-create-project');
const cancelButton = document.getElementById('cancel-project');
const projectForm = document.getElementById('create-project-form');
const orgSelect = document.getElementById('project-org');
const buSelect = document.getElementById('project-bu');

const toggleProjectForm = (show) => {
  if (!projectFormPanel) return;
  projectFormPanel.hidden = !show;
};

const renderProjects = () => {
  if (!projectGrid) return;
  const filters = state.filters;
  const filtered = state.projects.filter((project) => {
    const matchesSearch = filters.search
      ? project.name.toLowerCase().includes(filters.search) ||
        (project.purpose || '').toLowerCase().includes(filters.search)
      : true;
    const matchesBu =
      filters.buIds.size === 0 ||
      (project.buId && filters.buIds.has(project.buId));
    const matchesTags =
      filters.tags.size === 0 ||
      (project.tags || []).some((tag) => filters.tags.has(tag.toLowerCase()));
    return matchesSearch && matchesBu && matchesTags;
  });

  projectGrid.innerHTML = '';
  if (filtered.length === 0) {
    projectEmpty.hidden = false;
    return;
  }
  projectEmpty.hidden = true;

  filtered.forEach((project) => {
    const card = document.createElement('div');
    card.className = 'col-md-6';
    card.innerHTML = `
      <div class="card glass h-100 p-4 d-flex flex-column">
        <div class="d-flex align-items-center justify-content-between mb-3">
          <h3 class="h5 mb-0">${project.name}</h3>
          <a class="btn btn-outline-light btn-sm" href="project.html?id=${project._id}">Open</a>
        </div>
        <p class="text-fg-3 flex-grow-1">${project.purpose || 'No summary provided yet.'}</p>
        <div class="d-flex flex-wrap gap-2 mt-3">
          ${(project.tags || [])
            .map(
              (tag) =>
                `<span class="badge bg-secondary text-uppercase">${tag}</span>`
            )
            .join('')}
        </div>
      </div>
    `;
    projectGrid.appendChild(card);
  });
};

const renderFilters = () => {
  if (!buContainer || !tagContainer) return;
  buContainer.innerHTML = '';
  const buEntries = Object.values(state.businessUnits).flat();
  buEntries.forEach((unit) => {
    const label = document.createElement('label');
    label.className = 'd-flex align-items-center gap-2 text-fg-3';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = unit._id;
    input.addEventListener('change', () => {
      if (input.checked) {
        state.filters.buIds.add(unit._id);
      } else {
        state.filters.buIds.delete(unit._id);
      }
      renderProjects();
    });
    label.appendChild(input);
    label.appendChild(document.createTextNode(unit.name));
    buContainer.appendChild(label);
  });

  const tags = new Set();
  state.projects.forEach((project) =>
    (project.tags || []).forEach((tag) => tags.add(tag))
  );
  tagContainer.innerHTML = '';
  Array.from(tags).forEach((tag) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-outline-light btn-sm';
    button.textContent = tag;
    button.addEventListener('click', () => {
      const key = tag.toLowerCase();
      if (state.filters.tags.has(key)) {
        state.filters.tags.delete(key);
        button.classList.remove('active');
      } else {
        state.filters.tags.add(key);
        button.classList.add('active');
      }
      renderProjects();
    });
    tagContainer.appendChild(button);
  });
};

const populateOrgSelectors = () => {
  if (!orgSelect || !buSelect) return;
  orgSelect.innerHTML = '';
  buSelect.innerHTML = '<option value="">Select business unit</option>';
  state.organisations.forEach((org) => {
    const option = document.createElement('option');
    option.value = org._id;
    option.textContent = org.name;
    orgSelect.appendChild(option);
  });
  orgSelect.addEventListener('change', async () => {
    const orgId = orgSelect.value;
    buSelect.innerHTML = '<option value="">Select business unit</option>';
    if (!orgId) return;
    try {
      const res = await fetch(`/api/orgs/${orgId}/bus`, {
        credentials: 'include'
      });
      if (!res.ok) return;
      const data = await res.json();
      state.businessUnits[orgId] = data.businessUnits;
      data.businessUnits.forEach((unit) => {
        const option = document.createElement('option');
        option.value = unit._id;
        option.textContent = unit.name;
        buSelect.appendChild(option);
      });
    } catch (error) {
      console.error(error);
    }
  });
};

const fetchData = async () => {
  try {
    const [projectsRes, orgsRes] = await Promise.all([
      fetch('/api/projects', { credentials: 'include' }),
      fetch('/api/orgs', { credentials: 'include' })
    ]);
    if (projectsRes.ok) {
      const { projects } = await projectsRes.json();
      state.projects = projects || [];
    }
    if (orgsRes.ok) {
      const { organisations } = await orgsRes.json();
      state.organisations = organisations || [];
    }
  } catch (err) {
    console.error('Failed to load projects', err);
  }
  populateOrgSelectors();
  renderFilters();
  renderProjects();
};

searchInput?.addEventListener('input', (event) => {
  state.filters.search = event.target.value.toLowerCase();
  renderProjects();
});

createButton?.addEventListener('click', () => toggleProjectForm(true));
emptyCreateButton?.addEventListener('click', () => toggleProjectForm(true));
cancelButton?.addEventListener('click', () => {
  toggleProjectForm(false);
  projectForm?.reset();
});

projectForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(projectForm);
  const payload = {
    name: formData.get('name'),
    purpose: formData.get('purpose'),
    orgId: formData.get('orgId'),
    buId: formData.get('buId') || undefined,
    tags: (formData.get('tags') || '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
  };
  try {
    const res = await fetch('/api/projects', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      throw new Error('Failed to create project');
    }
    const { project } = await res.json();
    state.projects.push(project);
    renderFilters();
    renderProjects();
    toggleProjectForm(false);
    projectForm.reset();
  } catch (err) {
    console.error(err);
  }
});

fetchData();
