const adminState = {
  user: null,
  unlocked: false,
  organizations: [],
  selectedOrgId: null,
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

function setOrgEditFormDisabled(disabled) {
  const form = document.getElementById('orgEditForm');
  if (!form) return;
  const inputs = form.querySelectorAll('input, select, button');
  inputs.forEach(input => {
    input.disabled = disabled || adminState.saving;
  });
}

function updateOrgEditHeader(org) {
  const nameLabel = document.getElementById('selectedOrgName');
  const badge = document.getElementById('editOrgBadge');
  if (!org) {
    if (nameLabel) nameLabel.textContent = 'Select an organisation to edit its entitlements.';
    if (badge) badge.textContent = 'Not selected';
    setOrgEditFormDisabled(true);
    return;
  }

  if (nameLabel) nameLabel.textContent = `${org.name || 'Organisation'} (${org.slug || 'slug'})`;
  if (badge) badge.textContent = org.tier ? org.tier : 'Selected';
  setOrgEditFormDisabled(false);
}

function updateOrgEditForm(org) {
  const tierSelect = document.getElementById('orgTier');
  const typeSelect = document.getElementById('orgType');
  const seatInput = document.getElementById('seatLimit');
  const errorEl = document.getElementById('editOrgError');
  const form = document.getElementById('orgEditForm');
  if (errorEl) errorEl.textContent = '';
  if (!form) return;

  const products = Array.isArray(org?.productAccess) ? org.productAccess : [];
  const productCheckboxes = form.querySelectorAll('input[name="productAccess"]');

  if (tierSelect) tierSelect.value = org?.tier || 'personal';
  if (typeSelect) typeSelect.value = org?.orgType || 'both';
  if (seatInput) seatInput.value = org?.seatLimit ?? '';
  productCheckboxes.forEach(box => {
    box.checked = products.includes(box.value);
  });

  updateOrgEditHeader(org);
}

function selectOrganization(orgId) {
  const existing = adminState.organizations.find(org => org.id === orgId);
  adminState.selectedOrgId = existing ? orgId : null;
  updateOrgEditForm(existing || null);
  renderOrganizations(adminState.organizations);
}

function renderOrganizations(list) {
  const tbody = document.getElementById('orgTableBody');
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
    updateOrgEditForm(null);
    return;
  }

  list.forEach(org => {
    const row = document.createElement('tr');
    const products = Array.isArray(org.productAccess) ? org.productAccess.join(', ') : '';
    const seatsLabel = `${org.seatsUsed ?? 0} / ${org.seatLimit ?? '—'}`;
    row.classList.toggle('table-active', adminState.selectedOrgId === org.id);
    row.innerHTML = `
      <td>${org.name || '-'}</td>
      <td>${org.tier || '-'}</td>
      <td>${org.orgType || '-'}</td>
      <td>${products || '-'}</td>
      <td>${seatsLabel}</td>
      <td>${formatDate(org.createdAt)}</td>
      <td class="text-end">
        <button class="btn btn-outline-light btn-sm" data-org-id="${org.id}" type="button">Edit</button>
      </td>
    `;
    row.addEventListener('click', () => selectOrganization(org.id));
    const editBtn = row.querySelector('button[data-org-id]');
    if (editBtn) {
      editBtn.addEventListener('click', event => {
        event.stopPropagation();
        selectOrganization(org.id);
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
      await loadOrganizations();
    } else {
      setLockedState();
    }
  } catch (err) {
    console.error(err);
    showAccessDenied('Unable to fetch admin status.');
  }
}

async function loadOrganizations() {
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
    if (adminState.organizations.length > 0) {
      const stillSelected = adminState.organizations.some(org => org.id === adminState.selectedOrgId);
      adminState.selectedOrgId = stillSelected ? adminState.selectedOrgId : adminState.organizations[0].id;
    } else {
      adminState.selectedOrgId = null;
    }
    renderOrganizations(adminState.organizations);
    populateAuditOrgFilter();
    if (adminState.selectedOrgId) {
      const selected = adminState.organizations.find(org => org.id === adminState.selectedOrgId);
      updateOrgEditForm(selected || null);
    }
    await fetchAuditLog();
  } catch (err) {
    console.error(err);
    showAccessDenied('Unable to load organizations.');
  }
}

function collectProductAccess() {
  const form = document.getElementById('orgEditForm');
  if (!form) return [];
  const checked = form.querySelectorAll('input[name="productAccess"]:checked');
  return Array.from(checked).map(el => el.value);
}

async function saveOrganization(event) {
  event.preventDefault();
  const orgId = adminState.selectedOrgId;
  const errorEl = document.getElementById('editOrgError');
  if (errorEl) errorEl.textContent = '';
  if (!orgId) {
    if (errorEl) errorEl.textContent = 'Select an organisation before saving.';
    return;
  }

  const tierSelect = document.getElementById('orgTier');
  const typeSelect = document.getElementById('orgType');
  const seatInput = document.getElementById('seatLimit');
  const productAccess = collectProductAccess();
  const seatLimit = seatInput ? parseInt(seatInput.value, 10) : undefined;

  const payload = {
    tier: tierSelect?.value,
    orgType: typeSelect?.value,
    productAccess
  };

  if (!Number.isNaN(seatLimit)) {
    payload.seatLimit = seatLimit;
  }

  adminState.saving = true;
  setOrgEditFormDisabled(false);

  try {
    const res = await fetch(`/api/admin/organizations/${orgId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errorJson = await res.json().catch(() => ({}));
      const message = errorJson?.error || 'Unable to save organisation changes.';
      throw new Error(message);
    }

    await loadOrganizations();
  } catch (err) {
    console.error(err);
    if (errorEl) errorEl.textContent = err.message || 'Unable to save organisation changes.';
  } finally {
    adminState.saving = false;
    setOrgEditFormDisabled(false);
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
    await loadOrganizations();
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
    logoutButton.addEventListener('click', async () => {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      window.location.href = '/login.html';
    });
  }

  const orgEditForm = document.getElementById('orgEditForm');
  if (orgEditForm) {
    orgEditForm.addEventListener('submit', saveOrganization);
  }

  const refreshOrgs = document.getElementById('refreshOrgs');
  if (refreshOrgs) {
    refreshOrgs.addEventListener('click', () => loadOrganizations());
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

  updateOrgEditForm(null);
}

document.addEventListener('DOMContentLoaded', () => {
  initHandlers();
  initAdminConsole();
});
