const adminState = {
  user: null,
  memberships: [],
  effectiveLicense: null,
  organization: null,
  members: [],
  auditEvents: [],
  showActiveOnly: false,
  auditLoaded: false
};

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

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

function formatList(values) {
  if (!Array.isArray(values) || !values.length) return 'Not configured';
  return values.join(', ');
}

function formatDate(value) {
  if (!value) return 'Never';
  const date = new Date(value);
  return date.toLocaleString();
}

function renderOverview() {
  const org = adminState.organization;
  if (!org) return;
  setText('orgName', org.name || 'Untitled org');
  setText('orgTier', org.tier ? `${org.tier} tier` : 'Tier');
  setText('orgType', org.orgType || 'both');
  setText('productAccess', formatList(org.productAccess));
  setText('seatUsage', `${org.seatsUsed || 0} / ${org.seatLimit || 0}`);
  setText('seatHint', 'Active seats vs. limit');
  setText('orgCreated', org.createdAt ? new Date(org.createdAt).toLocaleDateString() : 'Unknown');
}

function renderMembers() {
  const tbody = document.getElementById('memberRows');
  const count = document.getElementById('memberCount');
  if (!tbody) return;
  tbody.innerHTML = '';
  const members = (adminState.members || []).filter(member =>
    adminState.showActiveOnly ? member.status === 'active' : true
  );
  if (count) count.textContent = `${members.length} members`;
  if (!members.length) {
    const row = document.createElement('tr');
    row.innerHTML = '<td colspan="6" class="text-fg-3 small">No members yet.</td>';
    tbody.appendChild(row);
    return;
  }

  members.forEach(member => {
    const row = document.createElement('tr');
    const roleSelect = document.createElement('select');
    roleSelect.className = 'form-select form-select-sm';
    ['owner', 'admin', 'member', 'viewer'].forEach(role => {
      const opt = document.createElement('option');
      opt.value = role;
      opt.textContent = role;
      if (member.role === role) opt.selected = true;
      roleSelect.appendChild(opt);
    });
    roleSelect.addEventListener('change', () => updateMember(member.id, { role: roleSelect.value }));

    const statusBadge = document.createElement('span');
    statusBadge.className = 'badge-soft';
    statusBadge.textContent = member.status === 'invited' ? 'Pending invite' : member.status;

    let inviteBadge = null;
    if (member.status === 'invited') {
      inviteBadge = document.createElement('div');
      inviteBadge.className = 'small text-brand d-flex align-items-center gap-1';
      inviteBadge.innerHTML = '<i class="bi bi-hourglass-split"></i> Pending invite';
    }

    const actionGroup = document.createElement('div');
    actionGroup.className = 'd-flex justify-content-end gap-2';
    if (member.status === 'invited') {
      const resendBtn = document.createElement('button');
      resendBtn.className = 'btn btn-outline-light btn-sm';
      resendBtn.textContent = 'Resend invite';
      resendBtn.addEventListener('click', () => resendInvite(member.id));
      actionGroup.appendChild(resendBtn);
    }

    const deactivateBtn = document.createElement('button');
    deactivateBtn.className = 'btn btn-outline-danger btn-sm';
    deactivateBtn.textContent = member.status === 'invited' ? 'Cancel invite' : 'Deactivate';
    deactivateBtn.addEventListener('click', () => {
      const message = member.status === 'invited' ? 'Cancel this invite?' : 'Deactivate this member?';
      if (!confirm(message)) return;
      removeMember(member.id);
    });
    actionGroup.appendChild(deactivateBtn);

    row.innerHTML = `
      <td>${member.name || '-'}</td>
      <td>${member.email || '-'}</td>
      <td></td>
      <td></td>
      <td>${formatDate(member.lastLoginAt)}</td>
      <td class="text-end"></td>
    `;
    row.children[2].appendChild(roleSelect);
    row.children[3].appendChild(statusBadge);
    if (inviteBadge) row.children[3].appendChild(inviteBadge);
    row.children[5].appendChild(actionGroup);
    tbody.appendChild(row);
  });
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

function formatActor(actor) {
  if (!actor) return 'Unknown';
  return actor.name || actor.email || 'Unknown';
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

function renderAuditEvents() {
  const tbody = document.getElementById('auditRows');
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
    const res = await fetch('/api/org/admin/audit', { credentials: 'include' });
    const json = await res.json();
    if (!res.ok || !json.ok) throw new Error(json.error || 'Unable to load audit log');
    adminState.auditEvents = json.events || [];
    adminState.auditLoaded = true;
    renderAuditEvents();
  } catch (err) {
    console.error(err);
    adminState.auditEvents = [];
    adminState.auditLoaded = true;
    renderAuditEvents();
  }
}

async function fetchAuthContext() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (res.status === 401) {
      window.location.href = '/api/auth/workos/login';
      return;
    }
    const json = await res.json();
    adminState.user = json.user;
    adminState.memberships = json.memberships || [];
    adminState.effectiveLicense = json.effectiveLicense || { tier: json.user?.licenseTier };
    toggleAgamaAdminNav(adminState.user);
    toggleOrgAdminNav({
      effectiveLicense: adminState.effectiveLicense,
      memberships: adminState.memberships,
      organizationContext: json.organizationContext
    });

    const hasBusiness = adminState.effectiveLicense?.tier === 'business';
    const homeAdmin = adminState.memberships.some(m => m.isHome && ['owner', 'admin'].includes(m.role));
    const contextAdmin = json.organizationContext && ['owner', 'admin'].includes(json.organizationContext.role);
    if (!(hasBusiness && (homeAdmin || contextAdmin))) {
      document.getElementById('adminAccess')?.classList.remove('d-none');
      return;
    }

    await fetchOverview();
    document.getElementById('adminContent').style.display = '';
  } catch (err) {
    document.getElementById('adminAccess')?.classList.remove('d-none');
  }
}

async function fetchOverview() {
  try {
    const res = await fetch('/api/org/admin/overview', { credentials: 'include' });
    const json = await res.json();
    if (!res.ok || !json.ok) throw new Error(json.error || 'Unable to load');
    adminState.organization = json.organization;
    adminState.members = json.members || [];
    renderOverview();
    renderMembers();
    fetchAuditLog();
  } catch (err) {
    setText('orgName', 'Unable to load organisation');
  }
}

async function inviteMember(event) {
  event.preventDefault();
  const form = event.target;
  const feedback = document.getElementById('inviteFeedback');
  if (feedback) feedback.textContent = '';
  const data = new FormData(form);
  const payload = {
    email: (data.get('email') || '').toString(),
    role: data.get('role') || 'member'
  };
  try {
    const res = await fetch('/api/org/admin/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!res.ok || !json.ok) throw new Error(json.error || 'Unable to invite');
    adminState.members.push(json.member);
    renderMembers();
    form.reset();
    if (feedback) feedback.textContent = 'Invite created. They will receive onboarding later.';
  } catch (err) {
    if (feedback) feedback.textContent = err.message;
  }
}

async function updateMember(id, updates) {
  try {
    const res = await fetch(`/api/org/admin/members/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(updates)
    });
    const json = await res.json();
    if (!res.ok || !json.ok) throw new Error(json.error || 'Unable to update');
    adminState.members = adminState.members.map(member => (member.id === id ? json.member : member));
    renderMembers();
  } catch (err) {
    alert(err.message || 'Unable to update member');
  }
}

async function removeMember(id) {
  try {
    const res = await fetch(`/api/org/admin/members/${id}`, { method: 'DELETE', credentials: 'include' });
    const json = await res.json();
    if (!res.ok || !json.ok) throw new Error(json.error || 'Unable to remove');
    adminState.members = adminState.members.filter(member => member.id !== id);
    renderMembers();
  } catch (err) {
    alert(err.message || 'Unable to remove member');
  }
}

async function resendInvite(id) {
  const feedback = document.getElementById('memberFeedback');
  if (feedback) feedback.textContent = '';
  try {
    const res = await fetch(`/api/org/admin/members/${id}/resend-invite`, {
      method: 'POST',
      credentials: 'include'
    });
    const json = await res.json();
    if (!res.ok || !json.ok) throw new Error(json.error || 'Unable to resend invite');
    if (feedback) feedback.textContent = 'Invite resent. Agama will manage onboarding or SSO access.';
  } catch (err) {
    if (feedback) feedback.textContent = err.message;
  }
}

function bindInviteForm() {
  const form = document.getElementById('inviteForm');
  if (form) {
    form.addEventListener('submit', inviteMember);
  }
}

function bindMemberFilters() {
  const toggle = document.getElementById('memberFilterToggle');
  if (!toggle) return;
  toggle.addEventListener('click', () => {
    adminState.showActiveOnly = !adminState.showActiveOnly;
    toggle.textContent = adminState.showActiveOnly ? 'Show all' : 'Show only active';
    renderMembers();
  });
}

function bindAuditControls() {
  const refresh = document.getElementById('refreshAudit');
  if (refresh) {
    refresh.addEventListener('click', () => fetchAuditLog());
  }
}

function bindLogout() {
  const logoutButton =
    document.getElementById('logoutButton') ||
    document.getElementById('logout');

  if (logoutButton) {
    logoutButton.addEventListener('click', event => {
      event.preventDefault();
      window.location.href = '/api/auth/logout';
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  bindInviteForm();
  bindLogout();
  bindAuditControls();
  bindMemberFilters();
  fetchAuthContext();
});
