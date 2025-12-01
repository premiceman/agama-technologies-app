const adminState = {
  user: null,
  unlocked: false,
  organizations: [],
  selectedOrg: null,
  currentView: 'overview',
  currentOrgId: null,
  currentOrgTab: 'overview',
  currentOrgOverview: null,
  currentOrgMembers: [],
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

function formatShortDate(value) {
  if (!value) return 'Never';
  const date = new Date(value);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
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

  const panels = document.querySelectorAll('[data-admin-view-panel]');
  panels.forEach(panel => {
    const target = panel.getAttribute('data-admin-view-panel');
    const isActive = target === view;
    panel.classList.toggle('d-none', !isActive);
    panel.classList.toggle('is-active', isActive);
  });

  // For now, we only have "overview" and "organizations" sharing the same UI.
  // Both should load the organisations overview table.
  if (view === 'overview' || view === 'organizations') {
    loadOrganizations();
  } else if (view === 'audit') {
    fetchAuditLog();
  } else {
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
      if (adminState.currentOrgId) {
        await loadOrgOverview(adminState.currentOrgId);
        if (adminState.currentOrgTab === 'audit') {
          await loadOrgAudit(adminState.currentOrgId);
        }
      }
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
  const triggers = document.querySelectorAll('[data-admin-view]');
  triggers.forEach(trigger => {
    trigger.addEventListener('click', event => {
      event.preventDefault();
      const view = trigger.getAttribute('data-admin-view') || 'overview';
      setAdminView(view);
    });
  });

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

function formatEventLabel(type) {
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

function getSelectedSuitesFromTiles(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return [];
  const tiles = Array.from(container.querySelectorAll('.suite-tile[aria-pressed="true"]'));
  return tiles.map(btn => btn.getAttribute('data-suite-id')).filter(Boolean);
}

function setSelectedSuitesOnTiles(containerId, suites) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const target = new Set(Array.isArray(suites) ? suites : []);
  const tiles = container.querySelectorAll('.suite-tile');
  tiles.forEach(btn => {
    const id = btn.getAttribute('data-suite-id');
    const isSelected = id && target.has(id);
    btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
  });
}

function initSuiteTiles(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const tiles = container.querySelectorAll('.suite-tile');
  tiles.forEach(btn => {
    btn.addEventListener('click', () => {
      const current = btn.getAttribute('aria-pressed') === 'true';
      btn.setAttribute('aria-pressed', current ? 'false' : 'true');
    });
  });
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

  if (idInput) idInput.value = '';
  if (nameInput) nameInput.value = '';
  if (typeSelect) typeSelect.value = 'vendor';
  if (tierSelect) tierSelect.value = 'business';
  if (domainsInput) domainsInput.value = '';
  if (seatInput) seatInput.value = '';
  if (workosInput) workosInput.value = '';
  setSelectedSuitesOnTiles('agamaOrgSuites', []);
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

  const domains = Array.isArray(org.domains) ? org.domains : [];

  if (idInput) idInput.value = org.id || '';
  if (nameInput) nameInput.value = org.name || '';
  if (typeSelect) typeSelect.value = org.orgType || 'vendor';
  if (tierSelect) tierSelect.value = org.tier || 'business';
  if (domainsInput) domainsInput.value = domains.join(', ');
  if (seatInput) seatInput.value = org.seatLimit ?? '';
  if (workosInput) workosInput.value = org.workosOrganizationId || '';

  setSelectedSuitesOnTiles('agamaOrgSuites', org?.productAccess || org?.platformAccess || []);

  if (feedback) feedback.textContent = '';
  if (title) title.textContent = 'Edit organisation';
  renderOrganizations(adminState.organizations);
}

function renderOrganizations(list) {
  const tbody = document.getElementById('agamaOrgRows');
  if (!tbody) return;
  tbody.innerHTML = '';
  const sortSelect = document.getElementById('agamaOrgSort');
  const sortMode = sortSelect?.value || 'utilisation';

  const sorted = Array.isArray(list) ? [...list] : [];
  sorted.sort((a, b) => {
    const utilA = a.seatLimit > 0 ? (a.seatsUsed || 0) / a.seatLimit : 0;
    const utilB = b.seatLimit > 0 ? (b.seatsUsed || 0) / b.seatLimit : 0;

    switch (sortMode) {
      case 'name':
        return (a.name || '').localeCompare(b.name || '');
      case 'createdAt':
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      case 'lastActivity':
        return new Date(b.lastActivityAt || 0) - new Date(a.lastActivityAt || 0);
      case 'utilisation':
    default:
      return utilB - utilA;
    }
  });

  renderOverviewOrganizations(sorted);
  updateOverviewSummary(sorted);

  if (!sorted.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 10;
    cell.className = 'text-fg-3';
    cell.textContent = 'No organisations found.';
    row.appendChild(cell);
    tbody.appendChild(row);
    return;
  }

  sorted.forEach(org => {
    const row = document.createElement('tr');
    const products = Array.isArray(org.productAccess) ? org.productAccess.join(', ') : '';
    const seatsLabel = `${org.seatsUsed ?? 0} / ${org.seatLimit ?? '—'}`;
    row.classList.toggle('table-active', adminState.selectedOrg?.id === org.id);
    const workosId = org.workosOrganizationId || '-';

    const nameCell = document.createElement('td');
    nameCell.textContent = org.name || '-';
    row.appendChild(nameCell);

    const tierCell = document.createElement('td');
    tierCell.textContent = org.tier || '-';
    row.appendChild(tierCell);

    const typeCell = document.createElement('td');
    typeCell.textContent = org.orgType || '-';
    row.appendChild(typeCell);

    const suitesCell = document.createElement('td');
    suitesCell.textContent = products || '-';
    row.appendChild(suitesCell);

    const seatsCell = document.createElement('td');
    seatsCell.textContent = seatsLabel;
    row.appendChild(seatsCell);

    const membersCell = document.createElement('td');
    membersCell.textContent = typeof org.memberCount === 'number' ? org.memberCount : '-';
    row.appendChild(membersCell);

    const lastActivityCell = document.createElement('td');
    lastActivityCell.textContent = formatShortDate(org.lastActivityAt);
    row.appendChild(lastActivityCell);

    const ssoCell = document.createElement('td');
    ssoCell.textContent = org.ssoEnabled ? 'Enabled' : 'None';
    row.appendChild(ssoCell);

    const workosCell = document.createElement('td');
    workosCell.className = 'text-truncate';
    workosCell.title = workosId;
    workosCell.textContent = workosId;
    row.appendChild(workosCell);

    const actionsCell = document.createElement('td');
    actionsCell.className = 'text-end';
    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-outline-light btn-sm';
    editBtn.type = 'button';
    editBtn.dataset.orgId = org.id;
    editBtn.textContent = 'Edit';
    actionsCell.appendChild(editBtn);

    // Only show Resync button if this org is linked to WorkOS
    if (org.workosOrganizationId) {
      const resyncBtn = document.createElement('button');
      resyncBtn.className = 'btn btn-outline-light btn-sm ms-1';
      resyncBtn.type = 'button';
      resyncBtn.dataset.orgId = org.id;
      resyncBtn.textContent = 'Resync';
      resyncBtn.title = 'Resync this organization from WorkOS';
      resyncBtn.addEventListener('click', event => {
        resyncOrgFromWorkOS(org, event);
      });
      actionsCell.appendChild(resyncBtn);
    }
    row.appendChild(actionsCell);

    row.addEventListener('click', () => {
      openOrgDetail(org);
      populateOrgEditor(org);
    });
    editBtn.addEventListener('click', event => {
      event.stopPropagation();
      populateOrgEditor(org);
    });
    tbody.appendChild(row);
  });
}

function renderOverviewOrganizations(list) {
  const tbody = document.getElementById('overviewOrgRows');
  if (!tbody) return;
  tbody.innerHTML = '';

  const recent = (Array.isArray(list) ? [...list] : [])
    .sort((a, b) => new Date(b.lastActivityAt || 0) - new Date(a.lastActivityAt || 0))
    .slice(0, 5);

  if (!recent.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 4;
    cell.className = 'text-fg-3';
    cell.textContent = 'No organisations yet. Create your first to unlock insights here.';
    row.appendChild(cell);
    tbody.appendChild(row);
    return;
  }

  recent.forEach(org => {
    const row = document.createElement('tr');
    row.className = 'table-row-link';

    const nameCell = document.createElement('td');
    const nameLabel = document.createElement('div');
    nameLabel.className = 'fw-semibold';
    nameLabel.textContent = org.name || '-';
    const tierLabel = document.createElement('div');
    tierLabel.className = 'text-fg-3 small';
    tierLabel.textContent = `${org.tier || '—'} • ${org.orgType || '—'}`;
    nameCell.appendChild(nameLabel);
    nameCell.appendChild(tierLabel);

    const suitesCell = document.createElement('td');
    const suites = Array.isArray(org.productAccess) ? org.productAccess : [];
    if (!suites.length) {
      suitesCell.textContent = '—';
    } else {
      suites.forEach(suite => {
        const pill = document.createElement('span');
        pill.className = 'pill-soft me-1 mb-1';
        pill.textContent = suite;
        suitesCell.appendChild(pill);
      });
    }

    const seatsCell = document.createElement('td');
    seatsCell.textContent = `${org.seatsUsed ?? 0} / ${org.seatLimit ?? '—'}`;

    const activityCell = document.createElement('td');
    activityCell.textContent = formatShortDate(org.lastActivityAt);

    row.appendChild(nameCell);
    row.appendChild(suitesCell);
    row.appendChild(seatsCell);
    row.appendChild(activityCell);

    row.addEventListener('click', () => setAdminView('organizations'));

    tbody.appendChild(row);
  });
}

function updateOverviewSummary(list) {
  const orgs = Array.isArray(list) ? list : [];
  const orgCount = orgs.length;
  const seatsUsed = orgs.reduce((sum, org) => sum + (org.seatsUsed || 0), 0);
  const seatLimit = orgs.reduce((sum, org) => sum + (org.seatLimit || 0), 0);
  const utilisation = seatLimit > 0 ? Math.round((seatsUsed / seatLimit) * 100) : 0;
  const suiteSet = new Set();
  orgs.forEach(org => {
    (org.productAccess || org.platformAccess || []).forEach(suite => suiteSet.add(suite));
  });

  const orgCountEl = document.getElementById('overviewOrgCount');
  const utilEl = document.getElementById('overviewSeatUtilisation');
  const seatBreakdownEl = document.getElementById('overviewSeatBreakdown');
  const suiteCountEl = document.getElementById('overviewSuiteCount');

  if (orgCountEl) orgCountEl.textContent = orgCount ? orgCount.toLocaleString() : '—';
  if (utilEl) utilEl.textContent = seatLimit ? `${utilisation}%` : '—';
  if (seatBreakdownEl) {
    seatBreakdownEl.textContent = seatLimit
      ? `${seatsUsed.toLocaleString()} of ${seatLimit.toLocaleString()} seats in use`
      : 'Set seat limits to track utilisation';
  }
  if (suiteCountEl) suiteCountEl.textContent = suiteSet.size ? suiteSet.size.toString() : '—';
}

async function openOrgDetail(org) {
  if (!org || !org.id) return;
  adminState.selectedOrg = org;
  adminState.currentOrgId = org.id;
  adminState.currentOrgTab = 'overview';

  const detailCard = document.getElementById('agamaOrgDetail');
  if (detailCard) {
    detailCard.classList.remove('d-none');
  }

  await loadOrgOverview(org.id);
  setOrgTab('overview');
}

async function loadOrgOverview(orgId) {
  if (!orgId) return;
  try {
    const res = await fetch(`/api/agama-admin/organizations/${orgId}/overview`, {
      credentials: 'include'
    });
    if (res.status === 403) {
      adminState.unlocked = false;
      setLockedState();
      return;
    }
    const json = await res.json();
    if (!res.ok || !json.ok) {
      throw new Error(json.error || 'Unable to load org overview');
    }

    adminState.currentOrgOverview = json.organization || null;
    adminState.currentOrgMembers = json.members || [];
    renderOrgOverview();
    renderOrgMembers();
  } catch (err) {
    console.error(err);
    adminState.currentOrgOverview = null;
    adminState.currentOrgMembers = [];
    renderOrgOverview();
    renderOrgMembers();
  }
}

async function loadOrgAudit(orgId) {
  const tbody = document.getElementById('agamaOrgAuditRows');
  if (!tbody || !orgId) return;
  tbody.innerHTML = '';

  try {
    const res = await fetch(`/api/agama-admin/audit?orgId=${encodeURIComponent(orgId)}`, {
      credentials: 'include'
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      throw new Error(json.error || 'Unable to load audit log');
    }

    const events = json.events || [];
    if (events.length === 0) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 4;
      cell.className = 'text-fg-3';
      cell.textContent = 'No recent events.';
      row.appendChild(cell);
      tbody.appendChild(row);
      return;
    }

    events.forEach(event => {
      const row = document.createElement('tr');

      const whenCell = document.createElement('td');
      whenCell.textContent = formatShortDate(event.createdAt);
      row.appendChild(whenCell);

      const typeCell = document.createElement('td');
      typeCell.textContent = formatEventLabel(event.type);
      row.appendChild(typeCell);

      const actorCell = document.createElement('td');
      actorCell.textContent = formatActor(event.actorUser);
      row.appendChild(actorCell);

      const summaryCell = document.createElement('td');
      summaryCell.textContent = buildSummary(event);
      row.appendChild(summaryCell);

      tbody.appendChild(row);
    });
  } catch (err) {
    console.error(err);
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 4;
    cell.className = 'text-fg-3';
    cell.textContent = 'Unable to load audit events.';
    row.appendChild(cell);
    tbody.appendChild(row);
  }
}

function renderOrgOverview() {
  const org = adminState.currentOrgOverview;
  const nameEl = document.getElementById('agamaOrgDetailName');
  const metaEl = document.getElementById('agamaOrgDetailMeta');
  const seatsEl = document.getElementById('agamaOrgDetailSeats');
  const membersEl = document.getElementById('agamaOrgDetailMembers');
  const lastEl = document.getElementById('agamaOrgDetailLastActivity');
  const domainsEl = document.getElementById('agamaOrgDetailDomains');
  const workosEl = document.getElementById('agamaOrgDetailWorkosId');
  const createdEl = document.getElementById('agamaOrgDetailCreatedAt');

  if (!org) {
    if (nameEl) nameEl.textContent = 'Select an organisation';
    if (metaEl) metaEl.textContent = '';
    if (seatsEl) seatsEl.textContent = '-';
    if (membersEl) membersEl.textContent = '-';
    if (lastEl) lastEl.textContent = '-';
    if (domainsEl) domainsEl.textContent = '-';
    if (workosEl) workosEl.textContent = '-';
    if (createdEl) createdEl.textContent = '-';
    return;
  }

  if (nameEl) nameEl.textContent = org.name || 'Untitled organisation';
  const suites = Array.isArray(org.productAccess) ? org.productAccess.join(', ') : 'None';
  if (metaEl) {
    metaEl.textContent = `${org.tier || 'tier'} • ${org.orgType || 'type'} • ${suites}`;
  }

  const seatsUsed = org.seatsUsed ?? 0;
  const seatLimit = org.seatLimit ?? 0;
  if (seatsEl) seatsEl.textContent = seatLimit ? `${seatsUsed} / ${seatLimit}` : `${seatsUsed}`;

  const memberCount = typeof org.memberCount === 'number' ? org.memberCount : adminState.currentOrgMembers.length;
  if (membersEl) membersEl.textContent = memberCount || 0;

  if (lastEl) lastEl.textContent = formatShortDate(org.lastActivityAt);

  if (domainsEl) {
    const domains = Array.isArray(org.domains) ? org.domains.join(', ') : '';
    domainsEl.textContent = domains || '—';
  }

  if (workosEl) {
    workosEl.textContent = org.workosOrganizationId || '—';
  }

  if (createdEl) {
    createdEl.textContent = formatShortDate(org.createdAt);
  }

  const badge = document.getElementById('agamaOrgMembersCountBadge');
  if (badge) {
    const count = adminState.currentOrgMembers.length;
    badge.textContent = `${count} member${count === 1 ? '' : 's'}`;
  }

  renderOrgAccessTab();
}

function renderOrgMembers() {
  const tbody = document.getElementById('agamaOrgMembersRows');
  const feedback = document.getElementById('agamaOrgMembersFeedback');
  if (!tbody) return;

  tbody.innerHTML = '';
  const members = adminState.currentOrgMembers || [];
  if (members.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 5;
    cell.className = 'text-fg-3';
    cell.textContent = 'No members found for this organisation.';
    row.appendChild(cell);
    tbody.appendChild(row);
    if (feedback) feedback.textContent = '';
    return;
  }

  members.forEach(member => {
    const row = document.createElement('tr');

    const nameCell = document.createElement('td');
    nameCell.textContent = member.name || '—';
    row.appendChild(nameCell);

    const emailCell = document.createElement('td');
    emailCell.textContent = member.email || member.userId || '—';
    row.appendChild(emailCell);

    const roleCell = document.createElement('td');
    roleCell.textContent = member.role || 'member';
    row.appendChild(roleCell);

    const statusCell = document.createElement('td');
    statusCell.textContent = member.status || 'active';
    row.appendChild(statusCell);

    const lastLoginCell = document.createElement('td');
    lastLoginCell.textContent = formatShortDate(member.lastLoginAt);
    row.appendChild(lastLoginCell);

    tbody.appendChild(row);
  });

  if (feedback) feedback.textContent = '';
}

function renderOrgAccessTab() {
  const org = adminState.currentOrgOverview;
  const tierInput = document.getElementById('agamaOrgAccessTier');
  const seatInput = document.getElementById('agamaOrgAccessSeatLimit');

  if (!org) {
    setSelectedSuitesOnTiles('agamaOrgAccessSuites', []);
    if (tierInput) tierInput.value = 'business';
    if (seatInput) seatInput.value = '';
    return;
  }

  const suites = Array.isArray(org.productAccess)
    ? org.productAccess
    : Array.isArray(org.platformAccess)
      ? org.platformAccess
      : [];

  setSelectedSuitesOnTiles('agamaOrgAccessSuites', suites);

  if (tierInput) tierInput.value = org.tier || 'business';
  if (seatInput) seatInput.value = org.seatLimit != null ? org.seatLimit : '';
}

async function saveOrgAccessSettings() {
  const org = adminState.currentOrgOverview;
  const feedback = document.getElementById('agamaOrgAccessFeedback');
  if (!org || !org.id) {
    if (feedback) feedback.textContent = 'Select an organisation first.';
    return;
  }

  const tierInput = document.getElementById('agamaOrgAccessTier');
  const seatInput = document.getElementById('agamaOrgAccessSeatLimit');
  const tier = tierInput?.value || org.tier || 'business';
  const seatRaw = seatInput?.value || '';
  const seatLimit = seatRaw ? parseInt(seatRaw, 10) : undefined;

  const productAccess = getSelectedSuitesFromTiles('agamaOrgAccessSuites');

  const payload = { tier, productAccess };
  if (!Number.isNaN(seatLimit)) {
    payload.seatLimit = seatLimit;
  }

  try {
    if (feedback) feedback.textContent = '';
    const res = await fetch(`/api/admin/organizations/${org.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) {
      throw new Error(json.error || 'Unable to save access settings.');
    }

    const updatedOrg = json.organization || {};
    adminState.currentOrgOverview = { ...org, ...updatedOrg };
    await loadOrganizations(org.id);
    await loadOrgOverview(org.id);

    if (feedback) feedback.textContent = 'Access settings saved.';
  } catch (err) {
    console.error(err);
    if (feedback) feedback.textContent = err.message || 'Unable to save access settings.';
  }
}

function setOrgTab(tab) {
  adminState.currentOrgTab = tab;
  const tabs = document.querySelectorAll('#agamaOrgTabs [data-org-tab]');
  tabs.forEach(btn => {
    const btnTab = btn.getAttribute('data-org-tab');
    btn.classList.toggle('active', btnTab === tab);
  });

  const panels = document.querySelectorAll('#agamaOrgTabPanels [data-org-tab-panel]');
  panels.forEach(panel => {
    const panelTab = panel.getAttribute('data-org-tab-panel');
    panel.classList.toggle('d-none', panelTab !== tab);
  });

  if (tab === 'access') {
    renderOrgAccessTab();
  } else if (tab === 'members') {
    renderOrgMembers();
  } else if (tab === 'audit' && adminState.currentOrgId) {
    loadOrgAudit(adminState.currentOrgId);
  }
}

function initOrgTabs() {
  const accessSuites = document.getElementById('agamaOrgAccessSuites');
  const sourceSuites = document.getElementById('agamaOrgSuites');
  if (accessSuites && sourceSuites && accessSuites.childElementCount === 0) {
    accessSuites.innerHTML = sourceSuites.innerHTML;
  }

  initSuiteTiles('agamaOrgAccessSuites');

  const tabs = document.querySelectorAll('#agamaOrgTabs [data-org-tab]');
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-org-tab') || 'overview';
      setOrgTab(tab);
    });
  });

  const accessSaveBtn = document.getElementById('agamaOrgAccessSave');
  if (accessSaveBtn) {
    accessSaveBtn.addEventListener('click', async () => {
      await saveOrgAccessSettings();
    });
  }
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
      <td>${formatEventLabel(event.type)}</td>
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

async function resyncOrgFromWorkOS(org, event) {
  if (!org || !org.id) return;

  if (event) {
    event.stopPropagation();
  }

  const btn = event?.currentTarget || null;
  if (btn) {
    btn.disabled = true;
    btn.classList.add('is-loading');
  }

  try {
    console.log('[admin-ui] Resync from WorkOS requested for org', {
      orgId: org.id,
      workosOrganizationId: org.workosOrganizationId
    });

    const res = await fetch(
      `/api/agama-admin/organizations/${encodeURIComponent(org.id)}/resync-from-workos`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    if (!res.ok) {
      let body = null;
      try {
        body = await res.json();
      } catch (e) {
        // ignore JSON parse errors
      }
      console.error('[admin-ui] Resync from WorkOS failed', {
        status: res.status,
        body
      });
      window.alert('Unable to resync organization from WorkOS. Check server logs for details.');
      return;
    }

    const json = await res.json();
    console.log('[admin-ui] Resync from WorkOS succeeded', json);

    // Reload organizations and keep focus on this org
    await loadOrganizations(org.id);
  } catch (err) {
    console.error('[admin-ui] Resync from WorkOS error', err);
    window.alert('Error resyncing organization from WorkOS. Check console for details.');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('is-loading');
    }
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

  if (!name) {
    if (feedback) feedback.textContent = 'Name is required to save the organisation.';
    return;
  }

  const productAccess = getSelectedSuitesFromTiles('agamaOrgSuites');
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
  initSuiteTiles('agamaOrgSuites');

  const createOrgBtn = document.getElementById('agamaCreateOrgBtn');
  if (createOrgBtn) {
    createOrgBtn.addEventListener('click', () => {
      resetOrgEditor();
      renderOrganizations(adminState.organizations);
    });
  }

  const sortSelect = document.getElementById('agamaOrgSort');
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      renderOrganizations(adminState.organizations || []);
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
  initOrgTabs();
  initAdminConsole();
});
