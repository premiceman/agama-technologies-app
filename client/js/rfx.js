const sectionsContainer = document.getElementById('rfx-sections');
const addSectionButton = document.getElementById('add-section');
const form = document.getElementById('rfx-form');
const projectSelect = document.getElementById('rfx-project');
const templateLibrary = document.getElementById('template-library');
const generateButton = document.getElementById('generate-rfx');

const state = {
  sections: [],
  projects: []
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

const renderSections = () => {
  if (!sectionsContainer) return;
  sectionsContainer.innerHTML = '';
  state.sections.forEach((section, sectionIndex) => {
    const card = document.createElement('div');
    card.className = 'glass p-4';
    card.innerHTML = `
      <div class="d-flex justify-content-between align-items-start mb-3">
        <div class="w-100">
          <label class="form-label" for="section-title-${section.id}">Section title</label>
          <input class="form-control" id="section-title-${section.id}" value="${section.title}" />
        </div>
        <button class="btn btn-outline-light btn-sm ms-3" data-remove="${section.id}">Remove</button>
      </div>
      <div class="mb-3">
        <label class="form-label" for="section-weight-${section.id}">Weight</label>
        <input class="form-control" id="section-weight-${section.id}" type="number" value="${section.weight}" />
      </div>
      <div class="d-grid gap-3" id="questions-${section.id}"></div>
      <button class="btn btn-outline-light btn-sm mt-3" data-add-question="${section.id}">Add question</button>
    `;
    sectionsContainer.appendChild(card);

    const titleInput = card.querySelector(`#section-title-${section.id}`);
    const weightInput = card.querySelector(`#section-weight-${section.id}`);
    titleInput.addEventListener('input', () => {
      section.title = titleInput.value;
    });
    weightInput.addEventListener('input', () => {
      section.weight = Number(weightInput.value) || 0;
    });

    const removeButton = card.querySelector(`[data-remove="${section.id}"]`);
    removeButton.addEventListener('click', () => {
      state.sections.splice(sectionIndex, 1);
      renderSections();
    });

    const addQuestionBtn = card.querySelector(`[data-add-question="${section.id}"]`);
    addQuestionBtn.addEventListener('click', () => {
      section.questions.push({ id: `${section.id}-q${section.questions.length + 1}`, text: '', type: 'text', weight: 1 });
      renderSections();
    });

    const questionContainer = card.querySelector(`#questions-${section.id}`);
    section.questions.forEach((question, questionIndex) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'glass p-3';
      wrapper.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-2">
          <strong>Question ${questionIndex + 1}</strong>
          <button class="btn btn-outline-light btn-sm" data-remove-question="${section.id}:${question.id}">Remove</button>
        </div>
        <label class="form-label" for="question-text-${question.id}">Prompt</label>
        <textarea class="form-control mb-2" id="question-text-${question.id}" rows="2">${question.text}</textarea>
        <div class="row g-2">
          <div class="col-md-6">
            <label class="form-label" for="question-type-${question.id}">Type</label>
            <select class="form-select" id="question-type-${question.id}">
              <option value="text" ${question.type === 'text' ? 'selected' : ''}>Text</option>
              <option value="multi-select" ${question.type === 'multi-select' ? 'selected' : ''}>Multi-select</option>
              <option value="scored" ${question.type === 'scored' ? 'selected' : ''}>Scored</option>
            </select>
          </div>
          <div class="col-md-6">
            <label class="form-label" for="question-weight-${question.id}">Weight</label>
            <input class="form-control" id="question-weight-${question.id}" type="number" value="${question.weight}" />
          </div>
        </div>
      `;
      questionContainer.appendChild(wrapper);

      const textArea = wrapper.querySelector(`#question-text-${question.id}`);
      const typeSelect = wrapper.querySelector(`#question-type-${question.id}`);
      const weightField = wrapper.querySelector(`#question-weight-${question.id}`);
      const removeQuestion = wrapper.querySelector(`[data-remove-question="${section.id}:${question.id}"]`);

      textArea.addEventListener('input', () => {
        question.text = textArea.value;
      });
      typeSelect.addEventListener('change', () => {
        question.type = typeSelect.value;
      });
      weightField.addEventListener('input', () => {
        question.weight = Number(weightField.value) || 0;
      });
      removeQuestion.addEventListener('click', () => {
        section.questions.splice(questionIndex, 1);
        renderSections();
      });
    });
  });
};

const addSection = (defaults = {}) => {
  const sectionId = `section-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
  state.sections.push({
    id: sectionId,
    title: defaults.title || 'New Section',
    weight: defaults.weight || 1,
    questions:
      defaults.questions?.map((question, idx) => ({
        id: `${sectionId}-q${idx + 1}`,
        text: question.text,
        type: question.type || 'text',
        weight: question.weight || 1
      })) || [
        {
          id: `${sectionId}-q1`,
          text: 'Describe requirements',
          type: 'text',
          weight: 1
        }
      ]
  });
  renderSections();
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
    if (state.projects.length === 1) {
      projectSelect.value = state.projects[0]._id;
    }
  } catch (err) {
    console.error('Failed to load projects', err);
  }
};

const applyTemplate = (templateName) => {
  const templates = {
    standard: [
      {
        title: 'Business Context',
        weight: 1,
        questions: [
          { text: 'Summarise business objectives and success criteria.', type: 'text', weight: 2 },
          { text: 'List current challenges or constraints.', type: 'text', weight: 1 }
        ]
      },
      {
        title: 'Technical Requirements',
        weight: 1,
        questions: [
          { text: 'Describe integration points and data sources.', type: 'multi-select', weight: 2 },
          { text: 'Provide performance benchmarks.', type: 'scored', weight: 3 }
        ]
      }
    ],
    security: [
      {
        title: 'Security & Compliance',
        weight: 1,
        questions: [
          { text: 'Outline certifications and attestations held.', type: 'multi-select', weight: 2 },
          { text: 'Describe data protection and privacy controls.', type: 'text', weight: 2 }
        ]
      }
    ],
    integration: [
      {
        title: 'Integration Readiness',
        weight: 1,
        questions: [
          { text: 'Detail available APIs and SDKs.', type: 'text', weight: 2 },
          { text: 'List supported authentication mechanisms.', type: 'multi-select', weight: 1 }
        ]
      }
    ]
  };
  const selected = templates[templateName] || [];
  state.sections = selected.map((section, index) => ({
    id: `${templateName}-section-${index + 1}`,
    title: section.title,
    weight: section.weight,
    questions: (section.questions || []).map((question, qIndex) => ({
      id: `${templateName}-q${index + 1}-${qIndex + 1}`,
      text: question.text,
      type: question.type || 'text',
      weight: question.weight || 1
    }))
  }));
  renderSections();
};

const buildPayload = () => {
  const projectId = projectSelect.value;
  const title = document.getElementById('rfx-title').value;
  const sections = state.sections.map((section) => ({
    id: section.id,
    title: section.title,
    questions: section.questions,
    weight: section.weight
  }));
  const weights = {};
  sections.forEach((section) => {
    weights[section.id] = Number(section.weight) || 1;
  });
  return { projectId, title, sections, weights, invitedVendorIds: [] };
};

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const payload = buildPayload();
    const res = await fetch('/api/rfx', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to create RFX');
    const { rfx } = await res.json();
    if (rfx?.projectId) {
      window.location.href = `project.html?id=${rfx.projectId}`;
    }
  } catch (err) {
    console.error(err);
  }
});

addSectionButton?.addEventListener('click', () => addSection());

templateLibrary?.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-template]');
  if (!button) return;
  applyTemplate(button.dataset.template);
});

generateButton?.addEventListener('click', async () => {
  const projectId = projectSelect.value;
  if (!projectId) {
    alert('Select a project before generating a template.');
    return;
  }
  try {
    const { template } = await fetchJson(`/api/rfx/${projectId}/generate`, {
      method: 'POST',
      body: JSON.stringify({ contextIds: [] })
    });
    state.sections = (template.sections || []).map((section) => ({
      id: section.id,
      title: section.title,
      weight: section.weight || 1,
      questions: (section.questions || []).map((question, idx) => ({
        id: question.id || `${section.id}-q${idx + 1}`,
        text: question.text,
        type: question.type || 'text',
        weight: question.weight || 1
      }))
    }));
    renderSections();
    document.getElementById('rfx-title').value = template.title || 'Generated RFX';
  } catch (err) {
    console.error('Failed to generate RFX', err);
  }
});

loadProjects();
addSection({ title: 'Business Context', weight: 1 });
