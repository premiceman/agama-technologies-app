const dashboardState = {
  user: null,
  platforms: [],
  organizationContext: null,
  memberships: [],
  effectiveLicense: null,
  rooms: []
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

function formatDate(value) {
  if (!value) return 'n/a';
  const date = new Date(value);
  return date.toLocaleString();
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

function personaLabel(persona) {
  switch (persona) {
    case 'vendor':
      return 'Vendor';
    case 'buyer':
      return 'Buyer';
    case 'both':
      return 'Vendor & buyer';
    case 'explorer':
      return 'Exploring';
    default:
      return 'Not set';
  }
}

function entitlementForPlatform(platform) {
  const { user, organizationContext, effectiveLicense } = dashboardState;
  const tier = effectiveLicense?.tier || user?.licenseTier || 'personal';
  const userPlatforms = Array.isArray(user?.platformAccess) ? user.platformAccess : [];
  const orgPlatforms = Array.isArray(organizationContext?.productAccess)
    ? organizationContext.productAccess
    : Array.isArray(organizationContext?.platformAccess)
      ? organizationContext.platformAccess
      : [];
  const hasPlatform = userPlatforms.includes(platform.id) || orgPlatforms.includes(platform.id);

  if (tier === 'guest') {
    return { allowed: false, reason: 'Guest accounts cannot open suites.' };
  }

  if (!hasPlatform) {
    return { allowed: false, reason: 'Not enabled for your organisation.' };
  }

  if (platform.requiresBusinessLicense && tier !== 'business') {
    return { allowed: false, reason: 'Requires a Business license.' };
  }

  return { allowed: true };
}

function renderAccountCard() {
  const { user, effectiveLicense, organizationContext } = dashboardState;
  if (!user) return;
  setText('accountName', user.name || user.email || 'Your account');
  setText('accountEmail', user.email || '');
  setText('licenseBadge', `${licenseLabel(effectiveLicense?.tier || user.licenseTier)} licence`);
  setText('profileLicenseBadge', licenseLabel(effectiveLicense?.tier || user.licenseTier));

  const narrative = document.getElementById('accountNarrative');
  const meta = document.getElementById('accountMeta');
  const requestRow = document.getElementById('businessRequestRow');
  const requestButton = document.getElementById('requestBusinessBtn');
  const requestHint = document.getElementById('requestBusinessHint');
  meta.innerHTML = '';
  if (requestRow) requestRow.style.display = 'none';
  if (narrative) narrative.textContent = '';

  if (effectiveLicense?.tier === 'business') {
    const home = effectiveLicense.homeOrg;
    const pieces = [];
    if (home?.name) pieces.push(`<strong>${home.name}</strong> (${home.orgType || 'multi-org'})`);
    if (home?.role) pieces.push(`Role: ${home.role}`);
    if (home?.tier) pieces.push(`Tier: ${home.tier}`);
    if (narrative) {
      narrative.textContent = 'You are on a Business workspace with organisation-wide access to suites and rooms.';
    }
    if (requestRow) requestRow.style.display = 'none';
    if (home) {
      const badge = document.createElement('span');
      badge.className = 'badge-soft';
      badge.textContent = 'Home organisation';
      meta.appendChild(badge);

      const details = document.createElement('div');
      details.className = 'text-fg-3 small';
      details.textContent = pieces.join(' • ');
      meta.appendChild(details);
    }
  } else if (effectiveLicense?.tier === 'personal') {
    if (narrative) {
      narrative.textContent = 'You are on a Personal workspace. Agama provisions Business workspaces directly for teams.';
    }
    if (requestRow) requestRow.style.display = '';
    const subject = encodeURIComponent('Request Business Workspace');
    const body = encodeURIComponent(
      `Hi Agama team,%0D%0A%0D%0AI would like to request a Business workspace for my organisation.%0D%0AAccount email: ${user.email}%0D%0ACurrent organisation context: ${organizationContext?.name || 'N/A'}%0D%0A`
    );
    const href = `mailto:sales@agamatechnologies.com?subject=${subject}&body=${body}`;
    if (requestButton) requestButton.href = href;
    if (requestHint) requestHint.textContent = 'We will coordinate onboarding via Agama or SSO.';
  } else if (effectiveLicense?.tier === 'guest') {
    if (narrative) {
      narrative.textContent = 'You have been invited into rooms as a guest. Organisation settings are not available to guests.';
    }
  } else {
    if (narrative) {
      narrative.textContent = 'You are using a personal workspace. ValueSphere is active; contact Agama to explore Business workspaces.';
    }
    const cta = document.createElement('a');
    cta.href = '#';
    cta.className = 'small link-light text-decoration-none';
    cta.textContent = 'Learn about Business workspaces';
    meta.appendChild(cta);
  }

  if (organizationContext?.name) {
    const org = document.createElement('div');
    org.className = 'text-fg-3 small';
    const roleLabel = organizationContext.role ? organizationContext.role.toUpperCase() : 'MEMBER';
    org.textContent = `${organizationContext.name} • ${roleLabel}`;
    meta.appendChild(org);
  }

  const personaBadge = document.createElement('span');
  personaBadge.className = 'badge-soft';
  personaBadge.textContent = `Persona: ${personaLabel(user.persona)}`;
  meta.appendChild(personaBadge);
}

function platformPersonaHint(platformId, persona) {
  if (persona === 'vendor' || persona === 'both') {
    if (platformId === 'valuesphere') return 'Start with Navigator assessments to quantify value for prospects.';
    if (platformId === 'revenueforge') return 'Wire your GTM motions to follow through on those assessments.';
  }
  if (persona === 'buyer') {
    if (platformId === 'procurepath') return 'Track contracts and vendors before inviting them into rooms.';
  }
  if (persona === 'explorer') {
    if (platformId === 'valuesphere') return 'Try a sandboxed ValueSphere assessment with sample data.';
  }
  return '';
}

function platformPersonaCta(platformId, persona) {
  if (persona === 'vendor' || persona === 'both') {
    if (platformId === 'valuesphere') return 'Start a value assessment';
    if (platformId === 'revenueforge') return 'Set up your GTM flows';
  }
  if (persona === 'buyer') {
    if (platformId === 'procurepath') return 'View your vendors & contracts';
  }
  if (persona === 'explorer' && platformId === 'valuesphere') {
    return 'Explore ValueSphere';
  }
  return 'Open';
}

function getPlatformById(id) {
  return dashboardState.platforms.find(platform => platform.id === id);
}

function renderSuites() {
  const list = document.getElementById('suiteList');
  const count = document.getElementById('suiteCount');
  list.innerHTML = '';
  const { platforms, user } = dashboardState;
  count.textContent = `${platforms.length} suites`;

  platforms.forEach(platform => {
    const entitlement = entitlementForPlatform(platform);
    const col = document.createElement('div');
    col.className = 'col-md-6';
    const active = entitlement.allowed;
    const target = platform.id === 'valuesphere' ? 'valuesphere-tool' : `${platform.id}-tool`;
    const actionLabel = platformPersonaCta(platform.id, user?.persona);
    const action = active
      ? `<a class="btn btn-primary btn-sm" href="/${target}.html">${actionLabel}</a>`
      : '';
    const reason = active ? 'Active' : entitlement.reason || 'Locked';
    const hint = platformPersonaHint(platform.id, user?.persona);
    col.innerHTML = `
      <div class="card glass h-100 p-3 d-flex flex-column gap-2">
        <div class="d-flex justify-content-between align-items-start gap-2">
          <div>
            <h3 class="h6 mb-1">${platform.name}</h3>
            <p class="text-fg-3 small mb-1">${platform.strapline}</p>
          </div>
          <span class="badge-soft">${active ? 'Active' : 'Locked'}</span>
        </div>
        <p class="text-fg-2 small flex-grow-1 mb-0">${platform.summary}${hint ? ` ${hint}` : ''}</p>
        <div class="d-flex justify-content-between align-items-center gap-2 mt-2">
          <span class="text-fg-3 small">${reason}</span>
          ${action}
        </div>
      </div>
    `;
    list.appendChild(col);
  });
}

function renderNextSteps() {
  const persona = dashboardState.user?.persona || 'unknown';
  const list = document.getElementById('nextStepsList');
  const personaBadge = document.getElementById('nextStepsPersona');
  const empty = document.getElementById('nextStepsEmpty');
  if (personaBadge) personaBadge.textContent = personaLabel(persona);
  if (!list || !empty) return;
  list.innerHTML = '';

  const steps = [];

  function addPlatformStep(platformId, title, description, cta, icon = 'bi-grid') {
    const platform = getPlatformById(platformId);
    if (!platform) return;
    const entitlement = entitlementForPlatform(platform);
    if (!entitlement.allowed) return;
    const target = platformId === 'valuesphere' ? 'valuesphere-tool' : `${platformId}-tool`;
    steps.push({ title, description, cta, href: `/${target}.html`, icon });
  }

  function addRoomsStep(title, description, cta) {
    steps.push({ title, description, cta, href: '/rooms.html', icon: 'bi-people' });
  }

  if (persona === 'vendor' || persona === 'both') {
    addPlatformStep(
      'valuesphere',
      'Kick off in ValueSphere',
      'Run a value assessment for your customer and capture the quantified impact.',
      'Start a value assessment',
      'bi-kanban'
    );
    addPlatformStep(
      'revenueforge',
      'Operationalise your GTM',
      'Stand up your GTM plays after the assessment to keep momentum.',
      'Set up your GTM flows',
      'bi-lightning-charge'
    );
    addRoomsStep(
      'Collaborate in an Engagement Room',
      'Share your assessment outcomes and GTM plan with buyers in one place.',
      'Open Engagement Rooms'
    );
  } else if (persona === 'buyer') {
    addPlatformStep(
      'procurepath',
      'Review vendors & contracts',
      'Check supplier health and renewal dates before you collaborate.',
      'View vendors & contracts',
      'bi-diagram-3'
    );
    addRoomsStep(
      'Invite vendors into a room',
      'Collaborate on renewals and decision workflows with your suppliers.',
      'Open Engagement Rooms'
    );
  } else if (persona === 'explorer') {
    addPlatformStep(
      'valuesphere',
      'Explore ValueSphere safely',
      'Use sample data to trial assessments without changing your production work.',
      'Explore ValueSphere',
      'bi-binoculars'
    );
    steps.push({
      title: 'Browse the docs',
      description: 'See how Agama fits vendors and buyers before you commit.',
      cta: 'Open docs',
      href: '/docs.html',
      icon: 'bi-journal-text'
    });
  }

  if (steps.length === 0) {
    empty.style.display = '';
    return;
  }

  empty.style.display = 'none';
  steps.forEach(step => {
    const row = document.createElement('div');
    row.className = 'glass p-3 d-flex flex-wrap justify-content-between align-items-start gap-3';
    row.innerHTML = `
      <div class="d-flex align-items-start gap-2">
        <i class="bi ${step.icon} text-brand"></i>
        <div>
          <div class="fw-semibold">${step.title}</div>
          <p class="text-fg-3 small mb-0">${step.description}</p>
        </div>
      </div>
      <a class="btn btn-primary btn-sm" href="${step.href}">${step.cta}</a>
    `;
    list.appendChild(row);
  });
}

function renderRooms() {
  const { rooms } = dashboardState;
  const own = rooms.filter(room => room?.membership?.isGuest !== true);
  const guest = rooms.filter(room => room?.membership?.isGuest === true);
  setText('roomsCount', `${rooms.length} rooms`);

  const ownList = document.getElementById('orgRooms');
  const guestList = document.getElementById('guestRooms');
  const ownEmpty = document.getElementById('orgRoomsEmpty');
  const guestEmpty = document.getElementById('guestRoomsEmpty');
  ownList.innerHTML = '';
  guestList.innerHTML = '';

  if (own.length === 0) {
    ownEmpty.classList.remove('d-none');
  } else {
    ownEmpty.classList.add('d-none');
    own.forEach(room => ownList.appendChild(renderRoomRow(room)));
  }

  if (guest.length === 0) {
    guestEmpty.classList.remove('d-none');
  } else {
    guestEmpty.classList.add('d-none');
    guest.forEach(room => guestList.appendChild(renderRoomRow(room, true)));
  }
}

function renderRoomRow(room, isGuest = false) {
  const wrapper = document.createElement('div');
  wrapper.className = 'card glass p-3';
  const role = room.membership?.role || 'member';
  const orgLabel = [
    room.vendorOrgName || room.vendorOrg,
    room.buyerOrgName || room.buyerOrg
  ].filter(Boolean).join(' • ');
  wrapper.innerHTML = `
    <div class="d-flex justify-content-between align-items-start gap-2 mb-1">
      <div>
        <a class="h6 d-block mb-1 link-light text-decoration-none" href="/room.html?id=${room.id}">${room.title || 'Untitled room'}</a>
        <div class="text-fg-3 small">${orgLabel || 'Multi-organisation room'}</div>
      </div>
      <span class="badge-soft">${isGuest ? 'Guest' : role}</span>
    </div>
    <div class="d-flex flex-wrap gap-3 align-items-center text-fg-3 small">
      <div><i class="bi bi-shield"></i> ${isGuest ? `${role} (Guest)` : role}</div>
      <div><i class="bi bi-clock-history"></i> Last activity ${formatDate(room.lastActivityAt)}</div>
    </div>
  `;
  return wrapper;
}

function renderPersonaWizard() {
  const wizard = document.getElementById('personaWizard');
  const persona = dashboardState.user?.persona || 'unknown';
  if (!wizard) return;
  if (persona === 'unknown') {
    wizard.classList.remove('d-none');
  } else {
    wizard.classList.add('d-none');
  }
}

async function updatePersonaSelection(persona) {
  const feedback = document.getElementById('personaFeedback');
  const buttons = document.querySelectorAll('[data-persona-choice]');
  buttons.forEach(btn => (btn.disabled = true));
  if (feedback) feedback.textContent = 'Saving your preferences...';
  try {
    const res = await fetch('/api/auth/persona', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ persona })
    });
    const json = await res.json();
    if (res.ok && json.ok) {
      dashboardState.user = json.user;
      renderAccountCard();
      renderSuites();
      renderNextSteps();
      renderGreeting();
      renderPersonaWizard();
      if (feedback) feedback.textContent = 'Thanks! Your workspace is now tailored.';
    } else if (feedback) {
      feedback.textContent = json.error || 'Unable to save persona.';
    }
  } catch (err) {
    if (feedback) feedback.textContent = 'Network error. Please try again.';
  } finally {
    buttons.forEach(btn => (btn.disabled = false));
  }
}

function bindPersonaWizard() {
  const buttons = document.querySelectorAll('[data-persona-choice]');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const choice = btn.getAttribute('data-persona-choice');
      if (choice) updatePersonaSelection(choice);
    });
  });
}

async function fetchWorkspace() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (res.status === 401) {
      window.location.href = '/api/auth/workos/login';
      return;
    }
    const json = await res.json();
    dashboardState.user = json.user;
    dashboardState.platforms = json.platforms || [];
    dashboardState.organizationContext = json.organizationContext || null;
    dashboardState.memberships = json.memberships || [];
    dashboardState.effectiveLicense = json.effectiveLicense || { tier: json.user?.licenseTier };
    toggleAgamaAdminNav(dashboardState.user);
    toggleOrgAdminNav({
      effectiveLicense: dashboardState.effectiveLicense,
      organizationContext: dashboardState.organizationContext,
      memberships: dashboardState.memberships
    });
    renderAccountCard();
    renderSuites();
    renderNextSteps();
    renderPersonaWizard();
    populateProfileForm();
    const roomsRes = await fetch('/api/rooms', { credentials: 'include' });
    if (roomsRes.ok) {
      const roomsJson = await roomsRes.json();
      dashboardState.rooms = roomsJson.rooms || [];
      renderRooms();
    }
    renderGreeting();
  } catch (err) {
    setText('workspaceGreeting', 'Unable to load workspace');
  }
}

function renderGreeting() {
  const { user, organizationContext } = dashboardState;
  if (!user) return;
  setText('workspaceGreeting', `Welcome, ${user.name || user.email}`);
  const orgContextEl = document.getElementById('orgContext');
  if (orgContextEl) {
    if (organizationContext?.name) {
      const roleLabel = organizationContext.role ? organizationContext.role.toUpperCase() : 'MEMBER';
      orgContextEl.textContent = `${organizationContext.name} • ${roleLabel}`;
    } else {
      orgContextEl.textContent = '';
    }
  }
}

function populateProfileForm() {
  const { user, effectiveLicense } = dashboardState;
  if (!user) return;
  const form = document.getElementById('profileForm');
  if (!form) return;
  document.getElementById('profileName').value = user.name || '';
  document.getElementById('profileEmail').value = user.email || '';
  document.getElementById('profileCompany').value = user.company || '';
  document.getElementById('profileRole').value = user.role || '';
  document.getElementById('profileIndustry').value = user.industry || '';
  setText('profileLicenseBadge', `${licenseLabel(effectiveLicense?.tier || user.licenseTier)} licence`);
}

function bindProfileForm() {
  const form = document.getElementById('profileForm');
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const submitBtn = document.getElementById('profileSubmit');
    const feedback = document.getElementById('profileFeedback');
    if (feedback) feedback.textContent = '';
    if (submitBtn) submitBtn.disabled = true;
    const formData = new FormData(form);
    const payload = {
      name: formData.get('name') || undefined,
      company: formData.get('company') || undefined,
      role: formData.get('role') || undefined,
      industry: formData.get('industry') || undefined
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
        dashboardState.user = json.user;
        populateProfileForm();
        if (feedback) feedback.textContent = 'Profile updated.';
      } else if (feedback) {
        feedback.textContent = json.error || 'Unable to update profile.';
      }
    } catch (err) {
      if (feedback) feedback.textContent = 'Network error. Please try again.';
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

function bindDangerZone() {
  const deleteButton = document.getElementById('deleteAccount');
  if (deleteButton) {
    deleteButton.addEventListener('click', async () => {
      if (!confirm('Are you sure you want to delete your account?')) return;
      await fetch('/api/auth/me', { method: 'DELETE', credentials: 'include' });
      window.location.href = '/';
    });
  }
}

function bindLogout() {
  const logoutButton = document.getElementById('logoutButton');
  if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      window.location.href = '/';
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  bindPersonaWizard();
  bindProfileForm();
  bindDangerZone();
  bindLogout();
  fetchWorkspace();
});
