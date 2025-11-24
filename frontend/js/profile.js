const profileState = {
  user: null,
  platforms: [],
  effectiveLicense: null,
  memberships: [],
  organizationContext: null
};

function setFieldValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value || '';
}

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

function licenseLabel(tier) {
  switch (tier) {
    case 'business':
      return 'Business';
    case 'guest':
      return 'Guest';
    default:
      return 'Personal';
  }
}

function entitlementForPlatform(platform) {
  const { user, organizationContext, effectiveLicense } = profileState;
  const tier = effectiveLicense?.tier || user?.licenseTier || 'personal';
  const userPlatforms = Array.isArray(user?.platformAccess) ? user.platformAccess : [];
  const orgPlatforms = Array.isArray(organizationContext?.productAccess)
    ? organizationContext.productAccess
    : Array.isArray(organizationContext?.platformAccess)
      ? organizationContext.platformAccess
      : [];
  const hasPlatform = userPlatforms.includes(platform.id) || orgPlatforms.includes(platform.id);

  if (tier === 'guest') return { allowed: false, reason: 'Guest accounts can only join rooms when invited.' };
  if (!hasPlatform) return { allowed: false, reason: 'Not enabled for your organisation.' };
  if (platform.requiresBusinessLicense && tier !== 'business') return { allowed: false, reason: 'Requires Business licence.' };
  return { allowed: true, reason: 'Active' };
}

async function loadProfile() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (res.status === 401) {
      window.location.href = '/api/auth/workos/login';
      return;
    }
    const json = await res.json();
    profileState.user = json.user;
    profileState.platforms = json.platforms || [];
    profileState.effectiveLicense = json.effectiveLicense || { tier: json.user?.licenseTier };
    profileState.memberships = json.memberships || [];
    profileState.organizationContext = json.organizationContext || null;
    toggleAgamaAdminNav(profileState.user);
    toggleOrgAdminNav({
      effectiveLicense: profileState.effectiveLicense,
      organizationContext: profileState.organizationContext,
      memberships: profileState.memberships
    });
    renderProfile();
    renderSuites();
  } catch (err) {
    setText('profileFeedback', 'Unable to load profile');
  }
}

function renderProfile() {
  const { user, effectiveLicense } = profileState;
  if (!user) return;
  setFieldValue('profileName', user.name);
  setFieldValue('profileEmail', user.email);
  setFieldValue('profileCompany', user.company);
  setFieldValue('profileRole', user.role);
  setText('profileLicense', `${licenseLabel(effectiveLicense?.tier || user.licenseTier)} licence`);

  const homeOrgContainer = document.getElementById('homeOrg');
  homeOrgContainer.innerHTML = '';
  if (effectiveLicense?.homeOrg) {
    const home = effectiveLicense.homeOrg;
    const badge = document.createElement('span');
    badge.className = 'badge-soft me-2';
    badge.textContent = 'Home org';
    const text = document.createElement('span');
    text.className = 'text-fg-2';
    text.textContent = `${home.name} • ${home.orgType || 'multi-org'} • ${home.role || 'member'}`;
    homeOrgContainer.appendChild(badge);
    homeOrgContainer.appendChild(text);
  } else {
    homeOrgContainer.textContent = 'No home organisation selected.';
  }

  renderMemberships();
  renderBusinessRequestCta();
}

function renderBusinessRequestCta() {
  const card = document.getElementById('businessRequestCard');
  const button = document.getElementById('profileRequestBusinessBtn');
  const hint = document.getElementById('profileRequestHint');
  if (!card) return;

  if (profileState.effectiveLicense?.tier === 'personal') {
    card.style.display = '';
    const subject = encodeURIComponent('Request Business Workspace');
    const body = encodeURIComponent(
      `Hi Agama team,%0D%0A%0D%0AI would like to request a Business workspace for my organisation.%0D%0AAccount email: ${profileState.user?.email || ''}%0D%0ACurrent organisation context: ${profileState.organizationContext?.name || 'N/A'}%0D%0A`
    );
    const href = `mailto:sales@agamatechnologies.com?subject=${subject}&body=${body}`;
    if (button) button.href = href;
    if (hint) hint.textContent = 'Agama will coordinate provisioning for Business workspaces.';
  } else {
    card.style.display = 'none';
  }
}

function renderMemberships() {
  const list = document.getElementById('membershipList');
  list.innerHTML = '';
  if (!profileState.memberships.length) {
    const empty = document.createElement('div');
    empty.className = 'text-fg-3 small';
    empty.textContent = 'No organisation memberships yet.';
    list.appendChild(empty);
    return;
  }

  profileState.memberships.forEach(membership => {
    const row = document.createElement('div');
    row.className = 'd-flex flex-wrap justify-content-between align-items-center glass p-3 rounded-3 mb-2';
    const left = document.createElement('div');
    left.innerHTML = `<strong>${membership.organizationName}</strong><div class="text-fg-3 small">${membership.organizationOrgType || 'multi-org'} • ${membership.organizationTier}</div>`;
    const right = document.createElement('div');
    right.className = 'd-flex flex-column text-end';
    const role = document.createElement('span');
    role.className = 'text-fg-2 small';
    role.textContent = `${membership.role} ${membership.isHome ? '(Home)' : ''}`;
    const status = document.createElement('span');
    status.className = 'badge-soft align-self-end mt-1';
    status.textContent = membership.status;
    right.appendChild(role);
    right.appendChild(status);
    row.appendChild(left);
    row.appendChild(right);
    list.appendChild(row);
  });
}

function renderSuites() {
  const container = document.getElementById('profileSuites');
  container.innerHTML = '';
  profileState.platforms.forEach(platform => {
    const entitlement = entitlementForPlatform(platform);
    const card = document.createElement('div');
    card.className = 'glass p-3 rounded-3 mb-3';
    card.innerHTML = `
      <div class="d-flex justify-content-between align-items-start gap-2 mb-1">
        <div>
          <div class="fw-semibold">${platform.name}</div>
          <div class="text-fg-3 small">${platform.strapline}</div>
        </div>
        <span class="badge-soft">${entitlement.allowed ? 'Active' : 'Locked'}</span>
      </div>
      <div class="text-fg-2 small mb-1">${platform.summary}</div>
      <div class="text-fg-3 small">${entitlement.reason}</div>
    `;
    container.appendChild(card);
  });
}

function bindSaveProfile() {
  const saveBtn = document.getElementById('saveProfile');
  if (!saveBtn) return;
  saveBtn.addEventListener('click', async () => {
    const feedback = document.getElementById('profileFeedback');
    if (feedback) feedback.textContent = '';
    saveBtn.disabled = true;
    const payload = {
      name: document.getElementById('profileName').value || undefined,
      company: document.getElementById('profileCompany').value || undefined,
      role: document.getElementById('profileRole').value || undefined
    };
    try {
      const res = await fetch('/api/auth/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        profileState.user = json.user;
        renderProfile();
        if (feedback) feedback.textContent = 'Profile saved.';
      } else if (feedback) {
        feedback.textContent = json.error || 'Unable to save profile.';
      }
    } catch (err) {
      if (feedback) feedback.textContent = 'Network error. Please try again.';
    } finally {
      saveBtn.disabled = false;
    }
  });
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
  bindSaveProfile();
  bindLogout();
  loadProfile();
});
