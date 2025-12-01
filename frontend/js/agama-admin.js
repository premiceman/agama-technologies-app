const adminState = {
  user: null,
  unlocked: false,
  organizations: [],
  selectedOrg: null,
  currentView: 'overview',
  saving: false,
  auditEvents: [],
  auditFilters: {
    orgId: '',
    userId: ''
  }
};

function toggleOrgAdminNav(authPayload) {
  const label = document.getElementById('orgAdminLabel');
  const section = document.getElementById('orgAdminSection');
  const { effectiveLicense, organizationContext, memberships } = authPayload || {};
  const hasBusiness = effectiveLicense?.tier === 'business';
  const isOrgAdmin = (memberships || []).some(m => m.isHome && ['owner', 'admin'].includes(m.role));
  const contextAdmin = organizationContext && ['owner', 'admin'].includes(organizationContext.role);
  const canSee = hasBusiness && (isOrgAdmin || contextAdmin);
  if (label && section) {
    label.style.display = canSee ? '' : 'none';
    section.style.display = canSee ? '' : 'none';
  }
}

function toggleAgamaAdminNav(user) {
  const label = document.getElementById('agamaAdminLabel');
  const section = document.getElementById('agamaAdminSection');
  const email = (user?.email || '').toLowerCase();
  const canSee = user?.isStaff === true && email.endsWith('@agamatechnologies.com');
  if (label && section) {
    label.style.display = canSee ? '' : 'none';
    section.style.display = canSee ? '' : 'none';
  }
}

function isAgamaStaff(user) {
  const email = (user?.email || '').toLowerCase();
  return user?.isStaff === true && email.endsWith('@agamatechnologies.com');
}

function setDisplay(el, show) {
  if (!el) return;
  el.classList.toggle('d-none', !show);
  el.hidden = !show;
}

function showAccessDenied(message) {
  const denied = document.getElementById('adminAccessDenied');
  const lockedCard = document.getElementById('adminLockedCard');
  const content = document.getElementById('adminContent');
  if (denied) {
    denied.textContent = message || denied.textContent || 'Access denied.';
  }
  setDisplay(denied, true);
  setDisplay(lockedCard, false);
  setDisplay(content, false);
}

function setLockedState() {
  const denied = document.getElementById('adminAccessDenied');
  const lockedCard = document.getElementById('adminLockedCard');
  const content = document.getElementById('adminContent');
  setDisplay(denied, false);
  setDisplay(lockedCard, true);
  setDisplay(content, false);
}

function setUnlockedState() {
  const denied = document.getElementById('adminAccessDenied');
  const lockedCard = document.getElementById('adminLockedCard');
  const content = document.getElementById('adminContent');
  setDisplay(denied, false);
  setDisplay(lockedCard, false);
  setDisplay(content, true);
}

function setAdminView(view) {
  adminState.currentView = view;
  const nav = document.getElementById('agamaAdminNav');
  if (nav) {
    const items = nav.querySelectorAll('.subnav-item');
    items.forEach(btn => {
      const btnView = btn.getAttribute('data-admin-view');
      btn.classList.toggle('is-active', btnView === view);
    });
  }

  // For now, we only have "overview" and "organizations" sharing the same UI.
  // Both should load the organisations overview table.
  if (view === 'overview' || view === 'organizations') {
    loadOrganizations();
  }
}

async function refreshAdminData() {
  if (adminState.saving) return;
  const btn = document.getElementById('adminRefreshBtn');
  if (btn) {
    btn.disabled = true;
    btn.classList.add('is-loading');
  }
  try {
    if (adminState.currentView === 'overview' || adminState.currentView === 'organizations') {
      await loadOrganizations(adminState.selectedOrg?.id || null);
    } else if (adminState.currentView === 'audit') {
      await fetchAuditLog();
    } else {
      await loadOrganizations(adminState.selectedOrg?.id || null);
    }
  } catch (err) {
    console.error('Admin refresh failed', err);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('is-loading');
    }
  }
}

function initAdminNav() {
  const nav = document.getElementById('agamaAdminNav');
  if (nav) {
    const items = nav.querySelectorAll('.subnav-item');
    items.forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.getAttribute('data-admin-view') || 'overview';
        setAdminView(view);
      });
    });
  }

  const refreshBtn = document.getElementById('adminRefreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', event => {
      event.preventDefault();
      refreshAdminData();
    });
  }
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return date.toLocaleString();
}

function formatActor(actor) {
  if (!actor) return 'Unknown';
  return actor.name || actor.email || 'Unknown';
}

function eventLabel(type) {
  const labels = {
    'org.member.added': 'Member invited',
    'org.member.updated': 'Member updated',
    'org.member.removed': 'Member removed',
    'room.created': 'Room created',
    'staff.console.unlocked': 'Staff console unlocked'
  };
  return labels[type] || type;
}

function buildSummary(event) {
  const actor = formatActor(event.actorUser);
  const target = formatActor(event.targetUser);
  const role = event.metadata?.role;
  const status = event.metadata?.status || event.metadata?.membershipStatus;
  switch (event.type) {
    case 'org.member.added':
      return `${actor} invited ${target || 'a member'}${role ? ` as ${role}` : ''}.`;
    case 'org.member.updated': {
      const changes = [];
      if (role && role !== event.metadata?.previousRole) changes.push(`role to ${role}`);
      if (status && status !== event.metadata?.previousStatus) changes.push(`status to ${status}`);
      const changeText = changes.length ? ` (${changes.join(', ')})` : '';
      return `${actor} updated ${target || 'a member'}${changeText}.`;
    }
    case 'org.member.removed':
      return `${actor} removed ${target || 'a member'} from the organisation.`;
    case 'room.created':
      return `${actor} created room "${event.metadata?.title || 'Untitled room'}".`;
    case 'staff.console.unlocked':
      return `${actor} unlocked the staff console.`;
    default:
      return event.metadata?.summary || 'Activity recorded.';
  }
}

function resetOrgEditor() {
  adminState.selectedOrg = null;
  const idInput = document.getElementById('agamaOrgId');
  const nameInput = document.getElementById('agamaOrgName');
  const typeSelect = document.getElementById('agamaOrgType');
  const tierSelect = document.getElementById('agamaOrgTier');
  const domainsInput = document.getElementById('agamaOrgDomains');
  const seatInput = document.getElementById('agamaOrgSeatLimit');
  const workosInput = document.getElementById('agamaOrgWorkosId');
  const feedback = document.getElementById('agamaOrgFormFeedback');
  const title = document.getElementById('agamaOrgEditorTitle');
  const suiteChecks = document.querySelectorAll('#agamaOrgForm input[type="checkbox"]');

  if (idInput) idInput.value = '';
  if (nameInput) nameInput.value = '';
  if (typeSelect) typeSelect.value = 'vendor';
  if (tierSelect) tierSelect.value = 'business';
  if (domainsInput) domainsInput.value = '';
  if (seatInput) seatInput.value = '';
  if (workosInput) workosInput.value = '';
  suiteChecks.forEach(box => {
    box.checked = false;
  });
  if (feedback) feedback.textContent = '';
  if (title) title.textContent = 'New organisation';
}

function populateOrgEditor(org) {
  if (!org) {
    resetOrgEditor();
    return;
  }

  adminState.selectedOrg = org;
  const idInput = document.getElementById('agamaOrgId');
  const nameInput = document.getElementById('agamaOrgName');
  const typeSelect = document.getElementById('agamaOrgType');
  const tierSelect = document.getElementById('agamaOrgTier');
  const domainsInput = document.getElementById('agamaOrgDomains');
  const seatInput = document.getElementById('agamaOrgSeatLimit');
  const workosInput = document.getElementById('agamaOrgWorkosId');
  const feedback = document.getElementById('agamaOrgFormFeedback');
  const title = document.getElementById('agamaOrgEditorTitle');
  const suiteChecks = document.querySelectorAll('#agamaOrgForm input[type="checkbox"]');

  const products = Array.isArray(org.productAccess) ? org.productAccess : [];
  const domains = Array.isArray(org.domains) ? org.domains : [];

  if (idInput) idInput.value = org.id || '';
  if (nameInput) nameInput.value = org.name || '';
  if (typeSelect) typeSelect.value = org.orgType || 'vendor';
  if (tierSelect) tierSelect.value = org.tier || 'business';
  if (domainsInput) domainsInput.value = domains.join(', ');
  if (seatInput) seatInput.value = org.seatLimit ?? '';
  if (workosInput) workosInput.value = org.workosOrganizationId || '';

  suiteChecks.forEach(box => {
    box.checked = products.includes(box.value);
  });

  if (feedback) feedback.textContent = '';
  if (title) title.textContent = 'Edit organisation';
  renderOrganizations(adminState.organizations);
}

function renderOrganizations(list) {
  const tbody = document.getElementById('agamaOrgRows');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!Array.isArray(list) || list.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 7;
    cell.className = 'text-fg-3';
    cell.textContent = 'No organisations found.';
    row.appendChild(cell);
    tbody.appendChild(row);
    return;
  }

  list.forEach(org => {
    const row = document.createElement('tr');
    const products = Array.isArray(org.productAccess) ? org.productAccess.join(', ') : '';
    const seatsLabel = `${org.seatsUsed ?? 0} / ${org.seatLimit ?? '—'}`;
    const workosId = org.workosOrganizationId || '-';
    row.classList.toggle('table-active', adminState.selectedOrg?.id === org.id);
    row.innerHTML = `
      <td>${org.name || '-'}</td>
      <td>${org.tier || '-'}</td>
      <td>${org.orgType || '-'}</td>
      <td>${products || '-'}</td>
      <td>${seatsLabel}</td>
      <td class="text-truncate" title="${workosId}">${workosId}</td>
      <td class="text-end">
        <button class="btn btn-outline-light btn-sm" data-org-id="${org.id}" type="button">Edit</button>
      </td>
    `;

    row.addEventListener('click', () => populateOrgEditor(org));
    const editBtn = row.querySelector('button[data-org-id]');
    if (editBtn) {
      editBtn.addEventListener('click', event => {
        event.stopPropagation();
        populateOrgEditor(org);
      });
    }
    tbody.appendChild(row);
  });
}

function populateAuditOrgFilter() {
  const select = document.getElementById('auditOrgFilter');
  if (!select) return;
  const current = select.value;
  select.innerHTML = '<option value="">All organisations</option>';
  adminState.organizations.forEach(org => {
    const option = document.createElement('option');
    option.value = org.id;
    option.textContent = `${org.name || 'Org'} (${org.slug || org.id})`;
    select.appendChild(option);
  });
  if (current && adminState.organizations.some(org => org.id === current)) {
    select.value = current;
  }
}

function renderAuditEvents() {
  const tbody = document.getElementById('auditTableBody');
  const empty = document.getElementById('auditEmpty');
  if (!tbody) return;
  tbody.innerHTML = '';
  const events = adminState.auditEvents || [];
  if (empty) empty.style.display = events.length ? 'none' : '';
  if (!events.length) return;

  events.forEach(event => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="text-nowrap">${formatDate(event.createdAt)}</td>
      <td>${formatActor(event.actorUser)}</td>
      <td>${eventLabel(event.type)}</td>
      <td>${buildSummary(event)}</td>
    `;
    tbody.appendChild(row);
  });
}

async function fetchAuditLog() {
  try {
    const params = new URLSearchParams();
    const { orgId, userId } = adminState.auditFilters;
    if (orgId) params.set('orgId', orgId);
    if (userId) params.set('userId', userId.trim());
    const query = params.toString();
    const res = await fetch(`/api/agama-admin/audit${query ? `?${query}` : ''}`, { credentials: 'include' });
    const json = await res.json();
    if (!res.ok || !json.ok) throw new Error(json.error || 'Unable to load audit events');
    adminState.auditEvents = json.events || [];
    renderAuditEvents();
  } catch (err) {
    console.error(err);
    adminState.auditEvents = [];
    renderAuditEvents();
  }
}

async function loadStatus() {
  try {
    const res = await fetch('/api/agama-admin/status', { credentials: 'include' });
    if (res.status === 403) {
      setLockedState();
      adminState.unlocked = false;
      return;
    }
    if (!res.ok) {
      throw new Error('Unable to load admin status');
    }
    const json = await res.json();
    adminState.unlocked = json.unlocked === true;
    if (adminState.unlocked) {
      setUnlockedState();
      setAdminView('overview');
    } else {
      setLockedState();
    }
  } catch (err) {
    console.error(err);
    showAccessDenied('Unable to fetch admin status.');
  }
}

async function loadOrganizations(focusOrgId) {
  try {
    const res = await fetch('/api/agama-admin/organizations', { credentials: 'include' });
    if (res.status === 403) {
      adminState.unlocked = false;
      setLockedState();
      return;
    }
    if (!res.ok) {
      throw new Error('Unable to load organizations');
    }
    const json = await res.json();
    adminState.organizations = json.organizations || [];
    const targetId = focusOrgId || adminState.selectedOrg?.id || null;
    const selected = targetId
      ? adminState.organizations.find(org => org.id === targetId) || null
      : null;
    adminState.selectedOrg = selected || null;
    if (!adminState.selectedOrg && adminState.organizations.length > 0) {
      adminState.selectedOrg = adminState.organizations[0];
    }

    renderOrganizations(adminState.organizations);
    populateAuditOrgFilter();
    populateOrgEditor(adminState.selectedOrg);
    await fetchAuditLog();
  } catch (err) {
    console.error(err);
    showAccessDenied('Unable to load organizations.');
  }
}

async function saveOrganization(event) {
  event.preventDefault();
  const feedback = document.getElementById('agamaOrgFormFeedback');
  if (feedback) feedback.textContent = '';

  const orgId = document.getElementById('agamaOrgId')?.value?.trim();
  const name = document.getElementById('agamaOrgName')?.value?.trim();
  const orgType = document.getElementById('agamaOrgType')?.value;
  const tier = document.getElementById('agamaOrgTier')?.value;
  const domainsRaw = document.getElementById('agamaOrgDomains')?.value || '';
  const seatLimitInput = document.getElementById('agamaOrgSeatLimit')?.value;
  const workosId = document.getElementById('agamaOrgWorkosId')?.value?.trim();
  const suiteChecks = document.querySelectorAll('#agamaOrgForm input[type="checkbox"]:checked');

  if (!name) {
    if (feedback) feedback.textContent = 'Name is required to save the organisation.';
    return;
  }

  const productAccess = Array.from(suiteChecks).map(el => el.value);
  const domains = domainsRaw
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  const seatLimit = seatLimitInput ? parseInt(seatLimitInput, 10) : undefined;

  const payload = { name, orgType, tier, productAccess, domains };
  if (!Number.isNaN(seatLimit)) payload.seatLimit = seatLimit;
  payload.workosOrganizationId = workosId || '';

  const requestInit = {
    method: orgId ? 'PATCH' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload)
  };

  const endpoint = orgId ? `/api/admin/organizations/${orgId}` : '/api/admin/organizations';

  try {
    const res = await fetch(endpoint, requestInit);
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) {
      const message = json.error || 'Unable to save organisation changes.';
      throw new Error(message);
    }

    const savedId = json.organization?.id || orgId;
    if (feedback) feedback.textContent = 'Saved organisation.';
    await loadOrganizations(savedId);
    const selected = adminState.organizations.find(org => org.id === savedId);
    populateOrgEditor(selected || null);
  } catch (err) {
    console.error(err);
    if (feedback) feedback.textContent = err.message || 'Unable to save organisation changes.';
  }
}

async function unlockConsole(secret) {
  const errorEl = document.getElementById('unlockError');
  if (errorEl) errorEl.textContent = '';
  try {
    const res = await fetch('/api/agama-admin/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ secret })
    });

    if (res.status === 403) {
      if (errorEl) errorEl.textContent = 'Invalid secret, please try again.';
      return;
    }

    if (!res.ok) {
      throw new Error('Unable to unlock admin console');
    }

    adminState.unlocked = true;
    setUnlockedState();
    setAdminView('overview');
  } catch (err) {
    console.error(err);
    if (errorEl) errorEl.textContent = 'Unable to unlock admin console. Please retry.';
  }
}

async function initAdminConsole() {
  try {
    const meRes = await fetch('/api/auth/me', { credentials: 'include' });
    if (meRes.status === 401) {
      window.location.href = '/api/auth/workos/login';
      return;
    }
    const me = await meRes.json();
    adminState.user = me.user;
    toggleAgamaAdminNav(adminState.user);
    toggleOrgAdminNav({
      effectiveLicense: me.effectiveLicense,
      organizationContext: me.organizationContext,
      memberships: me.memberships
    });

    if (!isAgamaStaff(adminState.user)) {
      showAccessDenied('Access denied. Staff only.');
      return;
    }

    await loadStatus();
  } catch (err) {
    console.error(err);
    showAccessDenied('Unable to load admin console.');
  }
}

function initHandlers() {
  const unlockForm = document.getElementById('unlockForm');
  if (unlockForm) {
    unlockForm.addEventListener('submit', async event => {
      event.preventDefault();
      const secretInput = document.getElementById('adminSecret');
      const secret = secretInput?.value || '';
      await unlockConsole(secret);
    });
  }

  const logoutButton = document.getElementById('logoutButton');
  if (logoutButton) {
    logoutButton.addEventListener('click', event => {
      event.preventDefault();
      window.location.href = '/api/auth/logout';
    });
  }

  const orgForm = document.getElementById('agamaOrgForm');
  if (orgForm) {
    orgForm.addEventListener('submit', saveOrganization);
  }

  const createOrgBtn = document.getElementById('agamaCreateOrgBtn');
  if (createOrgBtn) {
    createOrgBtn.addEventListener('click', () => {
      resetOrgEditor();
      renderOrganizations(adminState.organizations);
    });
  }

  const auditForm = document.getElementById('auditFilters');
  if (auditForm) {
    auditForm.addEventListener('submit', event => {
      event.preventDefault();
      const orgSelect = document.getElementById('auditOrgFilter');
      const userInput = document.getElementById('auditUserFilter');
      adminState.auditFilters.orgId = orgSelect?.value || '';
      adminState.auditFilters.userId = (userInput?.value || '').trim();
      fetchAuditLog();
    });
  }

  const clearAudit = document.getElementById('clearAuditFilters');
  if (clearAudit) {
    clearAudit.addEventListener('click', () => {
      const orgSelect = document.getElementById('auditOrgFilter');
      const userInput = document.getElementById('auditUserFilter');
      if (orgSelect) orgSelect.value = '';
      if (userInput) userInput.value = '';
      adminState.auditFilters = { orgId: '', userId: '' };
      fetchAuditLog();
    });
  }

  const refreshAudit = document.getElementById('refreshAudit');
  if (refreshAudit) {
    refreshAudit.addEventListener('click', () => fetchAuditLog());
  }

  resetOrgEditor();
}

document.addEventListener('DOMContentLoaded', () => {
  initHandlers();
  initAdminNav();
  initAdminConsole();
});
