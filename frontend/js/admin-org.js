const adminState = {
  user: null,
  memberships: [],
  effectiveLicense: null,
  organization: null,
  members: []
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
  const members = adminState.members || [];
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
    statusBadge.textContent = member.status;

    const actionGroup = document.createElement('div');
    actionGroup.className = 'd-flex justify-content-end gap-2';
    const deactivateBtn = document.createElement('button');
    deactivateBtn.className = 'btn btn-outline-danger btn-sm';
    deactivateBtn.textContent = 'Deactivate';
    deactivateBtn.addEventListener('click', () => {
      if (!confirm('Deactivate this member?')) return;
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
    row.children[5].appendChild(actionGroup);
    tbody.appendChild(row);
  });
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

function bindInviteForm() {
  const form = document.getElementById('inviteForm');
  if (form) {
    form.addEventListener('submit', inviteMember);
  }
}

function bindLogout() {
  const logoutButton = document.getElementById('logout');
  if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      window.location.href = '/';
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  bindInviteForm();
  bindLogout();
  fetchAuthContext();
});
