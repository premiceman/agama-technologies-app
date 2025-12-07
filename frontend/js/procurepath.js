const state = {
  context: null,
  vendors: [],
  selectedVendorId: null,
  rfxCache: new Map()
};

const STAGE_COLUMNS = [
  { id: 'intake', label: 'Intake', stages: ['intake'], description: 'New vendor intake and eligibility checks.' },
  { id: 'discovery', label: 'Discovery & RFX', stages: ['discovery', 'rfx_draft', 'responding'], description: 'Requirements, RFX drafting, and vendor responses.' },
  { id: 'evaluation', label: 'Evaluation', stages: ['evaluation', 'shortlist'], description: 'Scoring, risk review, and shortlist decisions.' },
  { id: 'decision', label: 'Decision & contracting', stages: ['decision', 'contract_signed', 'active'], description: 'Approvals, contracting, and active management.' },
  { id: 'sunset', label: 'Sunset', stages: ['sunset'], description: 'Vendors marked for exit or replacement.' }
];

const STAGE_LABELS = {
  intake: 'Intake',
  discovery: 'Discovery',
  rfx_draft: 'RFX draft',
  responding: 'Responding',
  evaluation: 'Evaluation',
  shortlist: 'Shortlist',
  decision: 'Decision',
  contract_signed: 'Contract signed',
  active: 'Active',
  sunset: 'Sunset'
};

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, { credentials: 'include', ...options });
  let json;
  try {
    json = await res.json();
  } catch (err) {
    throw new Error('Unexpected response from server');
  }
  if (!res.ok || json.error) {
    const message = json?.error || json?.message || 'Unable to load ProcurePath data.';
    throw new Error(message);
  }
  return json;
}

function setAlert(id, message, variant = 'warning') {
  const el = document.getElementById(id);
  if (!el) return;
  if (!message) {
    el.classList.add('d-none');
    el.textContent = '';
    return;
  }
  el.textContent = message;
  el.className = `alert alert-${variant}`;
}

function applyBuyerTheme(context) {
  document.body.dataset.theme = 'buyer';
  if (context?.themeHints?.primary) {
    document.body.dataset.theme = context.themeHints.primary;
  }
}

function ensureBuyerAccess(context, alertId) {
  const allowed = Boolean(context?.suiteEntitlements?.buyerSuite);
  if (!allowed) {
    setAlert(alertId, 'ProcurePath is restricted to Buyer Suite users. Switch to a buyer organisation or request access.', 'warning');
  }
  return allowed;
}

function bindProcurepathSearch() {
  const input = document.getElementById('procurepathSearchInput');
  const results = document.getElementById('procurepathSearchResults');
  if (input && results && window.SearchUI) {
    window.SearchUI.bindSearchField({
      input,
      resultsContainer: results,
      scope: 'procurement_vendor',
      contextLabel: 'ProcurePath scope'
    });
  }
}

function formatScore(vendor) {
  const score = vendor?.scorecard?.overallScore ?? vendor?.healthScore;
  if (score === undefined || score === null) return 'Score: —';
  return `Score: ${score}`;
}

function formatRisk(vendor) {
  const risk = vendor?.riskLevel || 'unknown';
  const summary = vendor?.riskSummary ? ` · ${vendor.riskSummary}` : '';
  return `Risk: ${risk}${summary}`;
}

function renderMetrics(overview) {
  const container = document.getElementById('overviewMetrics');
  if (!container) return;
  container.innerHTML = '';
  const items = [
    { label: 'Vendors tracked', value: overview?.totalVendors ?? 0, hint: 'Active in ProcurePath' },
    { label: 'Objectives', value: overview?.totalObjectives ?? 0, hint: 'Buyer-only targets across vendors' },
    { label: 'At-risk vendors', value: overview?.atRiskVendors ?? 0, hint: 'High risk or watchlist' },
    { label: 'Renewals due in 90d', value: overview?.upcomingRenewals ?? 0, hint: 'Renewals in the next 90 days' }
  ];

  items.forEach(item => {
    const col = document.createElement('div');
    col.className = 'col-md-3';
    col.innerHTML = `
      <div class="card glass h-100 p-3">
        <div class="text-fg-3 small">${item.label}</div>
        <div class="display-6 fw-bold">${item.value}</div>
        <div class="text-fg-3 small">${item.hint}</div>
      </div>
    `;
    container.appendChild(col);
  });
}

function vendorCardMarkup(vendor) {
  const stage = STAGE_LABELS[vendor.stage] || 'Not set';
  const score = vendor?.scorecard?.overallScore ?? vendor?.healthScore;
  const risk = vendor?.riskLevel || 'unknown';
  const riskClass = risk === 'high' || risk === 'critical' ? 'text-danger' : risk === 'medium' ? 'text-warning' : 'text-success';
  return `
    <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
      <div>
        <h3 class="h6 mb-1">${vendor.name}</h3>
        <div class="d-flex flex-wrap gap-2 align-items-center text-fg-3 small">
          <span class="badge bg-light text-dark">${stage}</span>
          <span class="badge bg-light text-dark">${vendor.tier || 'Tier n/a'}</span>
        </div>
      </div>
      <div class="text-end">
        <div class="text-fg-3 small">${vendor.domainCategory || 'Domain n/a'}</div>
      </div>
    </div>
    <div class="d-flex flex-wrap align-items-center gap-2 small">
      <span class="badge bg-primary-subtle text-primary">${score !== undefined && score !== null ? `Score ${score}` : 'Score —'}</span>
      <span class="badge bg-light ${riskClass}">${vendor.riskLevel ? `Risk ${vendor.riskLevel}` : 'Risk —'}</span>
      ${vendor.renewalDate ? `<span class="text-fg-3">Renewal ${formatDate(vendor.renewalDate)}</span>` : ''}
    </div>
  `;
}

function renderBoard(vendors) {
  const board = document.getElementById('stageBoard');
  const emptyState = document.getElementById('boardEmpty');
  if (!board || !emptyState) return;
  board.innerHTML = '';
  const hasVendors = Array.isArray(vendors) && vendors.length > 0;
  emptyState.hidden = hasVendors;

  STAGE_COLUMNS.forEach(column => {
    const lane = document.createElement('div');
    lane.className = 'agama-lane';
    const columnVendors = vendors.filter(v => column.stages.includes(v.stage) || (!v.stage && column.id === 'intake'));
    lane.innerHTML = `
      <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
        <div>
          <div class="fw-semibold">${column.label}</div>
          <div class="text-fg-3 small">${column.description}</div>
        </div>
        <span class="badge bg-light text-dark">${columnVendors.length}</span>
      </div>
    `;

    const cardStack = document.createElement('div');
    cardStack.className = 'd-flex flex-column gap-2';

    columnVendors.forEach(vendor => {
      const card = document.createElement('article');
      card.className = 'agama-card';
      card.innerHTML = vendorCardMarkup(vendor);
      cardStack.appendChild(card);
    });

    lane.appendChild(cardStack);
    board.appendChild(lane);
  });
}

function renderVendorList(vendors) {
  const list = document.getElementById('vendorList');
  const empty = document.getElementById('vendorListEmpty');
  if (!list || !empty) return;
  list.innerHTML = '';
  const hasVendors = Array.isArray(vendors) && vendors.length > 0;
  empty.hidden = hasVendors;

  vendors.forEach(vendor => {
    const col = document.createElement('div');
    col.className = 'col-md-4';
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'agama-card w-100 text-start';
    card.innerHTML = vendorCardMarkup(vendor);
    card.addEventListener('click', () => {
      state.selectedVendorId = vendor._id;
      renderVendorDetail();
      highlightSelectedVendor();
    });
    card.dataset.vendorId = vendor._id;
    col.appendChild(card);
    list.appendChild(col);
  });
}

function highlightSelectedVendor() {
  const cards = document.querySelectorAll('[data-vendor-id]');
  cards.forEach(card => {
    if (card.dataset.vendorId === state.selectedVendorId) {
      card.classList.add('agama-card-active');
    } else {
      card.classList.remove('agama-card-active');
    }
  });
}

function renderObjectives(vendor) {
  const list = document.getElementById('objectivesList');
  const empty = document.getElementById('objectivesEmpty');
  if (!list || !empty) return;
  list.innerHTML = '';
  const objectives = vendor?.objectives || [];
  empty.hidden = objectives.length > 0;
  objectives.forEach(obj => {
    const item = document.createElement('div');
    item.className = 'list-group-item bg-transparent text-fg';
    item.innerHTML = `
      <div class="d-flex justify-content-between align-items-start gap-2">
        <div>
          <div class="fw-semibold">${obj.title}</div>
          <div class="text-fg-3 small">${obj.targetMetric || ''} ${obj.targetValue || ''} ${obj.unit || ''}</div>
        </div>
        <span class="badge bg-light text-dark">${obj.status || 'on-track'}</span>
      </div>
      ${obj.notes ? `<div class="text-fg-3 small mt-1">${obj.notes}</div>` : ''}
    `;
    list.appendChild(item);
  });
}

function renderTouchpoints(vendor) {
  const list = document.getElementById('touchpointsList');
  const empty = document.getElementById('touchpointsEmpty');
  if (!list || !empty) return;
  list.innerHTML = '';
  const touchpoints = vendor?.touchpoints || [];
  empty.hidden = touchpoints.length > 0;
  touchpoints.forEach(tp => {
    const item = document.createElement('div');
    item.className = 'list-group-item bg-transparent text-fg';
    item.innerHTML = `
      <div class="d-flex justify-content-between align-items-start gap-2">
        <div>
          <div class="fw-semibold">${tp.type || 'Touchpoint'}</div>
          <div class="text-fg-3 small">${formatDate(tp.occurredOn) || 'Date not set'}</div>
        </div>
        <span class="badge bg-light text-dark">${tp.sentiment || 'Neutral'}</span>
      </div>
      <div class="text-fg-2">${tp.summary}</div>
      ${tp.followUp ? `<div class="text-fg-3 small mt-1">Follow-up: ${tp.followUp}</div>` : ''}
    `;
    list.appendChild(item);
  });
}

async function fetchRfx(id) {
  if (state.rfxCache.has(id)) {
    return state.rfxCache.get(id);
  }
  const data = await fetchJson(`/api/procurepath/rfx/${id}`);
  state.rfxCache.set(id, data);
  return data;
}

async function renderRfx(vendor) {
  const list = document.getElementById('rfxList');
  const empty = document.getElementById('rfxEmpty');
  if (!list || !empty) return;
  list.innerHTML = '';
  const linked = vendor?.linkedRfx || [];
  if (!linked.length) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  for (const rfxId of linked) {
    try {
      const data = await fetchRfx(rfxId);
      const item = document.createElement('div');
      item.className = 'list-group-item bg-transparent text-fg';
      const rfx = data.rfx;
      const items = data.items || [];
      const responses = data.responses || [];
      item.innerHTML = `
        <div class="d-flex justify-content-between align-items-start gap-2">
          <div>
            <div class="fw-semibold">${rfx.topicArea || 'RFX'}</div>
            <div class="text-fg-3 small">Status: ${rfx.status || 'draft'} · Sections: ${(rfx.sections || []).length}</div>
          </div>
          <span class="badge bg-primary-subtle text-primary">Questions: ${items.length}</span>
        </div>
        <div class="text-fg-3 small">Responses captured: ${responses.length}</div>
      `;
      list.appendChild(item);
    } catch (err) {
      const item = document.createElement('div');
      item.className = 'list-group-item bg-transparent text-fg';
      item.textContent = `Unable to load RFX ${rfxId}: ${err.message}`;
      list.appendChild(item);
    }
  }
}

function renderLinks(containerId, values, emptyId, labelPrefix) {
  const container = document.getElementById(containerId);
  const empty = document.getElementById(emptyId);
  if (!container || !empty) return;
  container.innerHTML = '';
  const hasValues = Array.isArray(values) && values.length > 0;
  empty.hidden = hasValues;
  if (!hasValues) return;
  values.forEach((val, idx) => {
    const pill = document.createElement('span');
    pill.className = 'badge bg-light text-dark';
    pill.textContent = `${labelPrefix} ${idx + 1}: ${val}`;
    container.appendChild(pill);
  });
}

function renderVendorDetail() {
  const vendor = state.vendors.find(v => v._id === state.selectedVendorId) || state.vendors[0];
  if (!vendor) return;
  state.selectedVendorId = vendor._id;
  setTextContent('vendorTitle', vendor.name || 'ProcurePath record');
  setTextContent('vendorName', vendor.name || 'Vendor');
  setTextContent('vendorStage', STAGE_LABELS[vendor.stage] || 'Stage pending');
  setTextContent('vendorTier', vendor.tier || 'Tier not set');
  setTextContent('vendorDomain', vendor.domainCategory || 'Domain not set');
  setTextContent('vendorHealth', vendor.healthScore !== undefined ? `Health ${vendor.healthScore}` : 'Health —');
  setTextContent('vendorRisk', formatRisk(vendor));
  setTextContent('vendorScore', formatScore(vendor));
  setTextContent('vendorRenewal', vendor.renewalDate ? `Renewal ${formatDate(vendor.renewalDate)}` : 'Renewal not scheduled');
  setTextContent('vendorNotes', vendor.notes || '');
  const tagContainer = document.getElementById('vendorTags');
  if (tagContainer) {
    tagContainer.innerHTML = '';
    (vendor.tags || []).forEach(tag => {
      const pill = document.createElement('span');
      pill.className = 'badge bg-light text-dark me-1';
      pill.textContent = tag;
      tagContainer.appendChild(pill);
    });
  }

  renderObjectives(vendor);
  renderTouchpoints(vendor);
  renderRfx(vendor);
  renderLinks('roomsList', vendor.linkedRooms, 'roomsEmpty', 'Room');
  renderLinks('assessmentsList', vendor.linkedAssessments, 'assessmentsEmpty', 'Assessment');
}

function setTextContent(id, value) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = value || '';
  }
}

async function loadBoard() {
  try {
    setAlert('procurepathAlert', '');
    const data = await fetchJson('/api/procurepath/overview');
    state.vendors = data.vendors || [];
    renderMetrics(data.overview || {});
    renderBoard(state.vendors);
  } catch (err) {
    setAlert('procurepathAlert', err.message, 'warning');
  }
}

async function loadVendors() {
  try {
    setAlert('procurepathDetailAlert', '');
    const data = await fetchJson('/api/procurepath/vendors');
    state.vendors = data.vendors || [];
    const detail = document.getElementById('vendorDetail');
    if (detail) detail.hidden = state.vendors.length === 0;
    renderVendorList(state.vendors);
    if (state.vendors.length > 0) {
      state.selectedVendorId = state.selectedVendorId || state.vendors[0]._id;
      renderVendorDetail();
      highlightSelectedVendor();
    }
  } catch (err) {
    setAlert('procurepathDetailAlert', err.message, 'warning');
  }
}

function attachCommonHandlers() {
  const logout = document.getElementById('logout');
  if (logout) {
    logout.addEventListener('click', async () => {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      window.location.href = '/';
    });
  }
}

async function init() {
  attachCommonHandlers();
  try {
    const context = await fetchJson('/api/me/context');
    state.context = context;
    applyBuyerTheme(context);
    bindProcurepathSearch();
    const page = document.body.dataset.page;
    if (!ensureBuyerAccess(context, page === 'procurepath-detail' ? 'procurepathDetailAlert' : 'procurepathAlert')) {
      return;
    }

    if (page === 'procurepath-home') {
      await loadBoard();
      const refresh = document.getElementById('refreshBoard');
      if (refresh) refresh.addEventListener('click', loadBoard);
    }

    if (page === 'procurepath-detail') {
      await loadVendors();
      const refresh = document.getElementById('refreshVendors');
      if (refresh) refresh.addEventListener('click', loadVendors);
    }
  } catch (err) {
    setAlert('procurepathAlert', err.message, 'warning');
    setAlert('procurepathDetailAlert', err.message, 'warning');
  }
}

init();
