const modelList = document.getElementById('model-list');
const schemaContainer = document.getElementById('assessment-schema');
const assessmentForm = document.getElementById('assessment-form');
const emptyState = document.getElementById('assessment-empty');
const projectSelect = document.getElementById('assessment-project-select');
const projectHidden = document.getElementById('assessment-project');
const typeInput = document.getElementById('assessment-type');
const versionInput = document.getElementById('assessment-version');
const generateButton = document.getElementById('generate-model');

const state = {
  models: [],
  selectedModel: null,
  projects: []
};

const getSchemaDefinition = (model) =>
  model?.schema || model?.definition || null;

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

const renderModelList = () => {
  if (!modelList) return;
  modelList.innerHTML = '';
  state.models.forEach((model) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-outline-light text-start';
    button.innerHTML = `<strong>${model.type}</strong><br /><span class="text-fg-3">Version ${model.version}</span>`;
    button.addEventListener('click', () => selectModel(model));
    modelList.appendChild(button);
  });
};

const renderProjects = () => {
  if (!projectSelect) return;
  projectSelect.innerHTML = '<option value="">Select project</option>';
  state.projects.forEach((project) => {
    const option = document.createElement('option');
    option.value = project._id;
    option.textContent = project.name;
    projectSelect.appendChild(option);
  });
  projectSelect.addEventListener('change', () => {
    projectHidden.value = projectSelect.value;
  });
  if (state.projects.length === 1) {
    projectSelect.value = state.projects[0]._id;
    projectHidden.value = state.projects[0]._id;
  }
};

const selectModel = (model) => {
  state.selectedModel = model;
  typeInput.value = model.type;
  versionInput.value = model.version;
  assessmentForm.hidden = false;
  emptyState.hidden = true;
  schemaContainer.innerHTML = '';
  const schema = getSchemaDefinition(model);
  (schema?.sections || []).forEach((section) => {
    const sectionBlock = document.createElement('div');
    sectionBlock.className = 'glass p-4';
    sectionBlock.innerHTML = `<h3 class="h5 mb-3">${section.title}</h3>`;
    const questionList = document.createElement('div');
    questionList.className = 'd-grid gap-3';
    (section.questions || []).forEach((question) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'd-grid gap-2';
      const label = document.createElement('label');
      label.className = 'form-label';
      label.setAttribute('for', `question-${question.id}`);
      label.textContent = question.text;
      let input;
      if (question.type === 'scale' || question.type === 'scored') {
        input = document.createElement('input');
        input.type = 'number';
        input.min = 0;
        input.max = 5;
        input.step = 1;
        input.placeholder = 'Enter score 1-5';
      } else if (question.type === 'multi-select') {
        input = document.createElement('input');
        input.placeholder = 'Enter comma separated values';
      } else {
        input = document.createElement('textarea');
        input.rows = 3;
      }
      input.className = 'form-control';
      input.id = `question-${question.id}`;
      input.name = `question-${question.id}`;
      wrapper.appendChild(label);
      wrapper.appendChild(input);
      questionList.appendChild(wrapper);
    });
    sectionBlock.appendChild(questionList);
    schemaContainer.appendChild(sectionBlock);
  });
};

const loadData = async () => {
  try {
    const [modelResponse, projectResponse] = await Promise.all([
      fetchJson('/api/maturity-models'),
      fetchJson('/api/projects')
    ]);
    state.models = (modelResponse.models || []).map((model) => ({
      ...model,
      schema: getSchemaDefinition(model)
    }));
    state.projects = projectResponse.projects || [];
    renderModelList();
    renderProjects();
  } catch (err) {
    console.error('Failed to load assessment data', err);
  }
};

assessmentForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!state.selectedModel) return;
  const formData = new FormData(assessmentForm);
  const responses = [];
  const schema = getSchemaDefinition(state.selectedModel);
  (schema?.sections || []).forEach((section) => {
    (section.questions || []).forEach((question) => {
      const fieldId = `question-${question.id}`;
      const raw = formData.get(fieldId);
      let value = raw;
      if (question.type === 'scale' || question.type === 'scored') {
        value = raw ? Number(raw) : 0;
      } else if (question.type === 'multi-select') {
        value = raw
          ? raw
              .split(',')
              .map((entry) => entry.trim())
              .filter(Boolean)
          : [];
      }
      responses.push({ questionId: question.id, value });
    });
  });

  const payload = {
    projectId: formData.get('projectId') || projectSelect.value,
    type: formData.get('type'),
    modelVersion: formData.get('modelVersion'),
    responses
  };

  try {
    const res = await fetch('/api/assessments', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      throw new Error('Failed to save assessment');
    }
    const { assessment } = await res.json();
    if (assessment?.projectId) {
      window.location.href = `project.html?id=${assessment.projectId}`;
    }
  } catch (err) {
    console.error(err);
  }
});

generateButton?.addEventListener('click', async () => {
  const industry = prompt('Industry focus for the assessment?');
  if (!industry) return;
  const size = prompt('Organisation size (e.g. Mid, Large)?') || 'Mid';
  const domainsInput = prompt(
    'List domains separated by commas (e.g. Data, Security, Observability).'
  );
  const domains = domainsInput
    ? domainsInput
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
  try {
    const { schema } = await fetchJson('/api/ai/assessments/model', {
      method: 'POST',
      body: JSON.stringify({ industry, size, domains })
    });
    const generatedModel = {
      type: `${industry.toLowerCase()}-custom`,
      version: 'ai-draft',
      schema
    };
    state.models.unshift(generatedModel);
    renderModelList();
    selectModel(generatedModel);
  } catch (err) {
    console.error('Unable to generate model', err);
  }
});

loadData();
