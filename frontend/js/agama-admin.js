const adminState = {
  user: null,
  unlocked: false
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
    return;
  }

  list.forEach(org => {
    const row = document.createElement('tr');
    const products = Array.isArray(org.productAccess) ? org.productAccess.join(', ') : '';
    row.innerHTML = `
      <td>${org.name || '-'}</td>
      <td>${org.slug || '-'}</td>
      <td>${org.tier || '-'}</td>
      <td>${org.orgType || '-'}</td>
      <td>${products || '-'}</td>
      <td>${org.seatLimit ?? '-'}</td>
      <td>${formatDate(org.createdAt)}</td>
    `;
    tbody.appendChild(row);
  });
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
    renderOrganizations(json.organizations || []);
  } catch (err) {
    console.error(err);
    showAccessDenied('Unable to load organizations.');
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
}

document.addEventListener('DOMContentLoaded', () => {
  initHandlers();
  initAdminConsole();
});
