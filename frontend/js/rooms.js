const state = {
  orgContext: null,
  user: null,
  effectiveLicenseTier: null,
  isGuest: false,
  organizations: [],
  revenueAccounts: [],
  roomId: null,
  room: null,
  members: [],
  issues: [],
  deliverables: [],
  files: [],
  rooms: [],
  roomFilters: { search: '', status: 'all', participation: 'all', persona: 'all' },
  selectedFileId: null,
  assignees: [],
  suiteEntitlements: null,
  persona: 'shared',
  eventsInterval: null
};

const SANDBOX_ORG_ID = '000000000000000000000000';

async function fetchJson(url, options = {}) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, credentials: 'include', ...options });
  if (!res.ok) {
    let message = 'Request failed';
    try {
      const data = await res.json();
      message = data.error || message;
    } catch (err) {
      // ignore
    }
    throw new Error(message);
  }
  return res.json();
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function licenseLabel(tier) {
  switch (tier) {
    case 'business':
      return 'Business license';
    case 'guest':
      return 'Guest license';
    default:
      return 'Personal license';
  }
}

function roomsEntitlement() {
  return { allowed: true };
}

function buildSalesEmailLink() {
  const subject = encodeURIComponent('Enable Engagement Rooms for my workspace');
  const body = encodeURIComponent(
    `Hi Agama Sales,%0D%0A%0D%0APlease enable Engagement Rooms for our workspace so we can centralise email, Slack/Teams, Monday, and Google Docs in one place.%0D%0AAccount email: ${
      state.user?.email || 'Not provided'
    }%0D%0AName: ${state.user?.name || 'Not provided'}%0D%0AOrganisation: ${
      state.orgContext?.name || 'Not set'
    }%0D%0ALicense tier: ${state.effectiveLicenseTier || state.user?.licenseTier || 'personal'}%0D%0AUse case: Consolidate multi-channel buyer conversations and documents into a single Engagement Room.%0D%0A`
  );
  return `mailto:sales@agamatechnologies.com?subject=${subject}&body=${body}`;
}

function renderRoomsLanding(entitlement) {
  const landing = document.getElementById('roomsLanding');
  const experience = document.getElementById('roomsExperience');
  toggle(experience, false);
  toggle(landing, true);

  const licenseTier = state.effectiveLicenseTier || state.user?.licenseTier || (state.isGuest ? 'guest' : 'personal');
  setText('roomsLandingBadge', licenseLabel(licenseTier));
  const contextPieces = [];
  if (state.orgContext?.name) contextPieces.push(state.orgContext.name);
  if (licenseTier) contextPieces.push(licenseLabel(licenseTier));
  setText('roomsLandingContext', contextPieces.join(' • '));
  if (entitlement?.reason) setText('roomsLandingMessage', entitlement.reason);

  const cta = document.getElementById('roomsSalesCta');
  if (cta) cta.href = buildSalesEmailLink();
}

function toggle(el, show) {
  if (!el) return;
  el.classList.toggle('d-none', !show);
  el.hidden = !show;
}

function resolveOrgName(orgId) {
  if (!orgId) return 'Unknown';
  const org = state.organizations.find(o => o.id === orgId || o._id === orgId);
  return org?.name || orgId;
}

function resolveGuestOrgId() {
  const guestOrg =
    state.organizations.find(org => org.orgType === 'buyer') ||
    state.organizations.find(org => org.orgType === 'both');
  const fallbackOrg = state.organizations[0];
  return (
    guestOrg?._id ||
    guestOrg?.id ||
    fallbackOrg?._id ||
    fallbackOrg?.id ||
    SANDBOX_ORG_ID
  );
}

function derivePersona(membership, room) {
  if (membership?.isGuest) return 'guest';
  const memberOrgId = membership?.organization?.id || membership?.organization?._id || membership?.organization;
  if (memberOrgId && room?.vendorOrg && memberOrgId === room.vendorOrg) return 'seller';
  if (memberOrgId && room?.buyerOrg && memberOrgId === room.buyerOrg) return 'buyer';
  return 'shared';
}

function allowedContexts() {
  switch (state.persona) {
    case 'seller':
      return ['shared', 'seller_only'];
    case 'buyer':
      return ['shared', 'buyer_only'];
    default:
      return ['shared'];
  }
}

function sanitizeContext(context) {
  const allowed = allowedContexts();
  if (allowed.includes(context)) return context;
  return 'shared';
}

function isContextVisible(context) {
  return allowedContexts().includes(context || 'shared');
}

function groupByContext(items = []) {
  const groups = { shared: [], seller_only: [], buyer_only: [] };
  items.forEach(item => {
    const ctx = item.context || 'shared';
    if (groups[ctx]) {
      groups[ctx].push(item);
    } else {
      groups.shared.push(item);
    }
  });
  return groups;
}

function renderContextBadge(context) {
  if (context === 'seller_only') return '<span class="badge-soft">Seller-only</span>';
  if (context === 'buyer_only') return '<span class="badge-soft">Buyer-only</span>';
  return '<span class="badge-soft">Shared</span>';
}

function enforceContextSelectors() {
  const allowed = allowedContexts();
  const selectorIds = ['messageContext', 'issueContext', 'deliverableContext', 'fileContext'];
  selectorIds.forEach(id => {
    const select = document.getElementById(id);
    if (!select) return;
    Array.from(select.options).forEach(opt => {
      opt.disabled = !allowed.includes(opt.value);
    });
    if (!allowed.includes(select.value)) select.value = allowed[0];
  });
}

function toggleContextColumns() {
  const allowed = allowedContexts();
  const showSeller = allowed.includes('seller_only');
  const showBuyer = allowed.includes('buyer_only');
  const sellerColumns = [
    'sellerMessageColumn',
    'sellerIssueColumn',
    'sellerDeliverableColumn',
    'sellerFileColumn'
  ];
  const buyerColumns = ['buyerMessageColumn', 'buyerIssueColumn', 'buyerDeliverableColumn', 'buyerFileColumn'];
  sellerColumns.forEach(id => toggle(document.getElementById(id), showSeller));
  buyerColumns.forEach(id => toggle(document.getElementById(id), showBuyer));
}

document.addEventListener('DOMContentLoaded', () => {
  const path = (window.location && window.location.pathname) || '';

  // Engagement Rooms index page – detect via URL first
  const isRoomsIndex =
    path === '/rooms' ||
    path === '/rooms.html' ||
    path.endsWith('/rooms');

  // Fallback: if the roomsExperience container exists, also treat it as the index page
  const roomsExperience = document.getElementById('roomsExperience');

  if (isRoomsIndex || roomsExperience) {
    initRoomsPage();
  }

  // Room detail page
  const roomTitle = document.getElementById('roomTitle');
  if (roomTitle) {
    initRoomDetailPage();
  }

  // Invite status page
  const inviteStatus = document.getElementById('roomInviteStatus');
  if (inviteStatus) {
    initRoomInvitePage();
  }

  const logoutButton = document.getElementById('logoutButton');
  if (logoutButton) {
    logoutButton.addEventListener('click', event => {
      event.preventDefault();
      window.location.href = '/api/auth/logout';
    });
  }
});

async function initRoomsPage() {
  try {
    let orgResp;
    try {
      orgResp = await fetchJson('/api/org/current');
    } catch (err) {
      orgResp = {};
    }

    state.orgContext = orgResp.organization || { name: 'Sandbox org', orgType: 'both' };
    state.user = orgResp.user || { name: 'Rooms user', licenseTier: 'business' };
    state.effectiveLicenseTier = orgResp.effectiveLicenseTier || orgResp.effectiveLicense?.tier || 'business';
    state.isGuest = state.user?.licenseTier === 'guest';
    state.suiteEntitlements = orgResp.suiteEntitlements || { org: {}, membership: {}, effective: {} };

    const licenseTier = state.effectiveLicenseTier || state.user?.licenseTier || 'personal';
    setText('licenseBadge', licenseLabel(licenseTier));

    try {
      const orgsResp = await fetchJson('/api/orgs');
      state.organizations = orgsResp.organizations || [];
    } catch (err) {
      state.organizations = [];
    }

    try {
      const accountsResp = await fetchJson('/api/revenueforge/accounts');
      state.revenueAccounts = accountsResp.accounts || [];
    } catch (err) {
      state.revenueAccounts = [];
    }
    setText(
      'roomsOrgContext',
      state.orgContext ? `${state.orgContext.name} • ${state.orgContext.orgType || 'multi-org'}` : 'No organization selected'
    );
    setupCreateRoomHandlers();
    bindRoomSearchDropdown();
    bindRoomFilters();
    const roomsResp = await fetchJson('/api/rooms');
    state.rooms = roomsResp.rooms || [];
    applyRoomFilters();
  } catch (err) {
    setText('roomsOrgContext', err.message || 'Unable to load rooms');
  }
}

function renderRooms(rooms) {
  const homeList = document.getElementById('homeRoomsList');
  const guestList = document.getElementById('guestRoomsList');
  if (!homeList || !guestList) return;

  const homeRooms = [];
  const guestRooms = [];
  rooms.forEach(room => {
    const isGuestRoom = room?.yourMembership?.isGuest === true;
    if (isGuestRoom) {
      guestRooms.push(room);
    } else {
      homeRooms.push(room);
    }
  });

  renderRoomSection('home', homeRooms);
  renderRoomSection('guest', guestRooms);
}

function bindRoomSearchDropdown() {
  const input = document.getElementById('roomSearchGlobal');
  const results = document.getElementById('roomSearchResults');
  if (input && results && window.SearchUI) {
    window.SearchUI.bindSearchField({
      input,
      resultsContainer: results,
      scope: 'engagement_room',
      contextLabel: 'Room scope'
    });
  }
}

function bindRoomFilters() {
  const search = document.getElementById('roomSearch');
  const status = document.getElementById('roomStatusFilter');
  const participation = document.getElementById('roomParticipationFilter');
  const persona = document.getElementById('roomPersonaFilter');
  const handlers = [
    [search, value => (state.roomFilters.search = value.toLowerCase())],
    [status, value => (state.roomFilters.status = value)],
    [participation, value => (state.roomFilters.participation = value)],
    [persona, value => (state.roomFilters.persona = value)]
  ];
  handlers.forEach(([el, fn]) => {
    if (!el || el.dataset.bound === 'true') return;
    el.dataset.bound = 'true';
    el.addEventListener('input', () => {
      fn(el.value || '');
      applyRoomFilters();
    });
    el.addEventListener('change', () => {
      fn(el.value || '');
      applyRoomFilters();
    });
  });
}

function applyRoomFilters() {
  const rooms = state.rooms || [];
  const filtered = rooms.filter(room => matchesRoomFilters(room));
  const summaryParts = [];
  if (state.roomFilters.status !== 'all') summaryParts.push(`Status: ${state.roomFilters.status}`);
  if (state.roomFilters.participation !== 'all') summaryParts.push(state.roomFilters.participation === 'guest' ? 'Guest rooms' : 'Hosted');
  if (state.roomFilters.persona !== 'all') summaryParts.push(`Persona: ${state.roomFilters.persona}`);
  if (state.roomFilters.search) summaryParts.push(`Search: "${state.roomFilters.search}"`);
  setText('roomsFilterSummary', summaryParts.length ? summaryParts.join(' • ') : 'All rooms');
  renderRooms(filtered);
}

function matchesRoomFilters(room) {
  const membership = room?.yourMembership || room?.membership || {};
  const persona = roomPersona(membership, room);
  if (state.roomFilters.status !== 'all' && room.status !== state.roomFilters.status) return false;
  if (state.roomFilters.participation === 'guest' && membership.isGuest !== true) return false;
  if (state.roomFilters.participation === 'hosted' && membership.isGuest === true) return false;
  if (state.roomFilters.persona === 'seller' && persona !== 'seller') return false;
  if (state.roomFilters.persona === 'buyer' && persona !== 'buyer') return false;
  if (state.roomFilters.persona === 'shared' && persona !== 'shared' && persona !== 'guest') return false;
  const q = (state.roomFilters.search || '').toLowerCase();
  if (!q) return true;
  const haystack = [room.title, resolveOrgName(room.vendorOrg), resolveOrgName(room.buyerOrg)].join(' ').toLowerCase();
  return haystack.includes(q);
}

function roomPersona(membership, room) {
  if (membership?.isGuest) return 'guest';
  const memberOrgId = membership?.organization?.id || membership?.organization?._id || membership?.organization;
  if (memberOrgId && room?.vendorOrg && memberOrgId === room.vendorOrg) return 'seller';
  if (memberOrgId && room?.buyerOrg && memberOrgId === room.buyerOrg) return 'buyer';
  return 'shared';
}

function renderRoomSection(prefix, rooms) {
  const list = document.getElementById(`${prefix}RoomsList`);
  const empty = document.getElementById(`${prefix}RoomsEmpty`);
  const count = document.getElementById(`${prefix}RoomsCount`);
  if (!list || !empty || !count) return;

  list.innerHTML = '';
  toggle(empty, !rooms.length);
  count.textContent = rooms.length;
  if (!rooms.length) return;

  rooms.forEach(room => {
    const col = document.createElement('div');
    col.className = 'col-md-6 col-xl-4';
    const card = document.createElement('div');
    card.className = 'card glass p-3 h-100';

    const role = room.yourMembership?.role || room.membership?.role || 'viewer';
    const isGuest = room.yourMembership?.isGuest === true;
    const vendor = resolveOrgName(room.vendorOrg);
    const buyer = resolveOrgName(room.buyerOrg);

    card.innerHTML = `
      <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
        <div>
          <h3 class="h6 mb-1">${room.title || 'Untitled room'}</h3>
          <div class="text-fg-3 small">Vendor: ${vendor} • Buyer: ${buyer}</div>
          <div class="text-fg-3 small">Your role: ${role}${isGuest ? ' (Guest)' : ''}</div>
        </div>
        <div class="d-flex gap-2 align-items-center">
          ${isGuest ? '<span class="badge-soft">Guest</span>' : ''}
          <span class="badge-soft">${role}</span>
        </div>
      </div>
      <div class="d-flex flex-wrap gap-3 align-items-center mb-2">
        <div class="small"><i class="bi bi-list-task"></i> Issues: ${room.summary?.issues?.total || 0}</div>
        <div class="small"><i class="bi bi-flag"></i> Open: ${room.summary?.issues?.open || 0}</div>
        <div class="small"><i class="bi bi-check2-circle"></i> Deliverables: ${room.summary?.deliverables?.total || 0}</div>
      </div>
      <div class="d-flex justify-content-between align-items-center">
        <div class="text-fg-3 small">Last activity ${room.lastActivityAt ? new Date(room.lastActivityAt).toLocaleString() : 'n/a'}</div>
        <a class="btn btn-outline-light btn-sm" href="/room.html?id=${room.id}">Open</a>
      </div>
    `;
    col.appendChild(card);
    list.appendChild(col);
  });
}

function setupCreateRoomHandlers() {
  const button = document.getElementById('createRoomButton');
  const form = document.getElementById('createRoomForm');
  const modalEl = document.getElementById('createRoomModal');
  if (!button || !form || !modalEl || button.dataset.bound === 'true') return;
  button.dataset.bound = 'true';

  const feedback = document.getElementById('createRoomFeedback');
  const modal = typeof bootstrap !== 'undefined' ? new bootstrap.Modal(modalEl) : null;

  if (state.isGuest) {
    button.classList.add('disabled');
    button.setAttribute('aria-disabled', 'true');
    button.title = 'Guest users cannot create rooms.';
  }

  button.addEventListener('click', () => {
    if (state.isGuest || !modal) return;
    populateCreateRoomModal();
    if (feedback) feedback.textContent = '';
    modal.show();
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (state.isGuest) return;
    if (feedback) feedback.textContent = '';
    const title = document.getElementById('createRoomTitle')?.value.trim();
    const vendorOrg = document.getElementById('createRoomVendorOrg')?.value;
    const buyerAccount = document.getElementById('createRoomBuyerOrg')?.value;
    if (!title) {
      if (feedback) feedback.textContent = 'Title is required.';
      return;
    }
    if (!vendorOrg || !buyerAccount) {
      if (feedback) feedback.textContent = 'Select a vendor and buyer account.';
      return;
    }

    try {
      const buyerOrg = resolveGuestOrgId();
      const res = await fetchJson('/api/rooms', {
        method: 'POST',
        body: JSON.stringify({ title, vendorOrg, buyerOrg, revenueAccount: buyerAccount })
      });
      const createdId = res.room?.id || res.room?._id;
      if (modal) modal.hide();
      if (createdId) {
        window.location.href = `/room.html?id=${createdId}`;
      } else {
        window.location.reload();
      }
    } catch (err) {
      if (feedback) feedback.textContent = err.message;
    }
  });
}

function populateCreateRoomModal() {
  const vendorSelect = document.getElementById('createRoomVendorOrg');
  const buyerSelect = document.getElementById('createRoomBuyerOrg');
  if (!vendorSelect || !buyerSelect) return;
  vendorSelect.innerHTML = '';
  buyerSelect.innerHTML = '';
  if (!state.organizations.length) {
    const emptyVendor = document.createElement('option');
    emptyVendor.textContent = 'No organizations available';
    emptyVendor.disabled = true;
    emptyVendor.selected = true;
    vendorSelect.appendChild(emptyVendor);
  } else {
    state.organizations.forEach(org => {
      const vendorOpt = document.createElement('option');
      vendorOpt.value = org.id || org._id;
      vendorOpt.textContent = org.name;
      vendorSelect.appendChild(vendorOpt);
    });
  }

  if (!state.revenueAccounts.length) {
    const emptyBuyer = document.createElement('option');
    emptyBuyer.textContent = 'No RevenueForge accounts found';
    emptyBuyer.disabled = true;
    emptyBuyer.selected = true;
    buyerSelect.appendChild(emptyBuyer);
  } else {
    state.revenueAccounts.forEach(account => {
      const buyerOpt = document.createElement('option');
      buyerOpt.value = account._id || account.id;
      buyerOpt.textContent = account.name || 'Unnamed account';
      buyerSelect.appendChild(buyerOpt);
    });
  }
}

async function initRoomDetailPage() {
  const params = new URLSearchParams(window.location.search);
  const roomId = params.get('id');
  if (!roomId) {
    setText('roomTitle', 'Room not found');
    return;
  }
  state.roomId = roomId;
  try {
    const orgResp = await fetchJson('/api/org/current');
    state.orgContext = orgResp.organization;
    state.isGuest = orgResp.user?.licenseTier === 'guest';
    const roomResp = await fetchJson(`/api/rooms/${roomId}`);
    state.room = roomResp.room;
    state.roomMembership = state.room?.yourMembership || state.room?.membership;
    state.isRoomGuest = state.roomMembership?.isGuest === true;
    state.persona = derivePersona(state.roomMembership, state.room);
    renderRoomHeader();
    configureOrgControls();
    enforceContextSelectors();
    toggleContextColumns();
    bindAiActions();
    await Promise.all([loadMembers(), loadMessages(), loadIssues(), loadDeliverables(), loadFiles(), loadInvites()]);
    subscribeToRoomEvents(state.roomId);
  } catch (err) {
    setText('roomMeta', err.message || 'Unable to load room');
  }
}

function renderRoomHeader() {
  setText('roomTitle', state.room?.title || 'Untitled room');
  const membership = state.roomMembership || state.room?.yourMembership || state.room?.membership || {};
  const role = membership.role || 'viewer';
  const roleLabel = role === 'room_admin' ? 'Room admin' : role;
  const isGuest = membership.isGuest === true;
  const roleText = `Your role: ${roleLabel}${isGuest ? ' (Guest)' : ''}`;
  setText('roomRole', `${roleLabel}${isGuest ? ' • Guest' : ''}`);
  setText('roomRoleSummary', roleText);
  const meta = [];
  if (state.room?.vendorOrg) meta.push(`Vendor org: ${state.room.vendorOrg}`);
  if (state.room?.buyerOrg) meta.push(`Buyer org: ${state.room.buyerOrg}`);
  const membershipOrg = membership.organization;
  if (membershipOrg) {
    const orgName = membershipOrg.name || resolveOrgName(membershipOrg.id || membershipOrg._id || membershipOrg);
    meta.push(`Membership org: ${orgName}`);
  }
  setText('roomMeta', meta.join(' • '));
  const guestNotice = document.getElementById('roomGuestNotice');
  toggle(guestNotice, isGuest);
}

function configureOrgControls() {
  const membership = state.roomMembership || state.room?.yourMembership || state.room?.membership || {};
  const isGuestMember = membership.isGuest === true;
  const isAdmin = membership.role === 'room_admin' && !isGuestMember;
  const canEdit = ['editor', 'room_admin'].includes(membership.role) && !isGuestMember;

  document.querySelectorAll('#issueForm input, #issueForm textarea, #issueForm select, #issueForm button').forEach(el => {
    el.disabled = !canEdit;
  });
  document.querySelectorAll('#deliverableForm input, #deliverableForm textarea, #deliverableForm select, #deliverableForm button').forEach(
    el => {
      el.disabled = !canEdit;
    }
  );
  const validationButton = document.getElementById('fileValidate');
  if (validationButton) validationButton.disabled = !canEdit;
  const uploadInputs = document.querySelectorAll('#fileUploadForm input, #fileUploadForm button');
  uploadInputs.forEach(el => {
    el.disabled = !canEdit;
  });

  const memberActions = document.getElementById('memberActions');
  if (memberActions) memberActions.classList.toggle('d-none', !isAdmin);
  const memberRoleReminder = document.getElementById('memberRoleReminder');
  if (memberRoleReminder) memberRoleReminder.textContent = isAdmin ? 'You can manage members' : 'Admin only';

  if (isGuestMember) {
    const guestHideSelectors = ['#assigneeSearch', '#addAssigneeButton', '#assigneeHelp', '#memberSearch', '#memberOptions'];
    guestHideSelectors.forEach(sel => {
      const el = document.querySelector(sel);
      if (el) {
        el.disabled = true;
        el.classList.add('opacity-75');
      }
    });
    const help = document.getElementById('assigneeHelp');
    if (help) help.textContent = 'Guest users cannot search the organization directory.';
  }

  bindForms(canEdit, isAdmin);
  populateOrgSelectors();
  enforceContextSelectors();
  toggleContextColumns();
}

function bindForms(canEdit, isAdmin) {
  const memberSearch = document.getElementById('memberSearch');
  const assigneeSearch = document.getElementById('assigneeSearch');

  const messageForm = document.getElementById('messageForm');
  if (messageForm) {
    messageForm.addEventListener('submit', async e => {
      e.preventDefault();
      const bodyInput = document.getElementById('messageBody');
      const feedback = document.getElementById('messageFeedback');
      feedback.textContent = '';
      if (!bodyInput.value.trim()) return;
      try {
        await fetchJson(`/api/rooms/${state.roomId}/messages`, {
          method: 'POST',
          body: JSON.stringify({ body: bodyInput.value, context: sanitizeContext(document.getElementById('messageContext')?.value) })
        });
        bodyInput.value = '';
        await loadMessages();
        feedback.textContent = 'Message posted.';
      } catch (err) {
        feedback.textContent = err.message;
      }
    });
  }

  const issueForm = document.getElementById('issueForm');
  if (issueForm) {
    issueForm.addEventListener('submit', async e => {
      e.preventDefault();
      if (!canEdit) return;
      const feedback = document.getElementById('issueFeedback');
      feedback.textContent = '';
      const payload = {
        title: document.getElementById('issueTitle').value,
        status: document.getElementById('issueStatus').value,
        priority: document.getElementById('issuePriority').value,
        notes: document.getElementById('issueNotes').value || undefined,
        dueDate: document.getElementById('issueDueDate').value || undefined,
        assignees: state.assignees,
        context: sanitizeContext(document.getElementById('issueContext')?.value)
      };
      try {
        await fetchJson(`/api/rooms/${state.roomId}/issues`, { method: 'POST', body: JSON.stringify(payload) });
        feedback.textContent = 'Issue created.';
        state.assignees = [];
        renderAssignees();
        issueForm.reset();
        await loadIssues();
      } catch (err) {
        feedback.textContent = err.message;
      }
    });
  }

  const deliverableForm = document.getElementById('deliverableForm');
  if (deliverableForm) {
    deliverableForm.addEventListener('submit', async e => {
      e.preventDefault();
      if (!canEdit) return;
      const feedback = document.getElementById('deliverableFeedback');
      feedback.textContent = '';
      const payload = {
        title: document.getElementById('deliverableTitle').value,
        status: document.getElementById('deliverableStatus').value,
        owner: document.getElementById('deliverableOwner').value,
        dueDate: document.getElementById('deliverableDueDate').value || undefined,
        description: document.getElementById('deliverableDescription').value || undefined,
        relatedIssues: Array.from(document.getElementById('deliverableIssues').selectedOptions).map(opt => opt.value),
        context: sanitizeContext(document.getElementById('deliverableContext')?.value)
      };
      try {
        await fetchJson(`/api/rooms/${state.roomId}/deliverables`, { method: 'POST', body: JSON.stringify(payload) });
        feedback.textContent = 'Deliverable added.';
        deliverableForm.reset();
        await loadDeliverables();
      } catch (err) {
        feedback.textContent = err.message;
      }
    });
  }

  const fileUploadForm = document.getElementById('fileUploadForm');
  if (fileUploadForm) {
    fileUploadForm.addEventListener('submit', async e => {
      e.preventDefault();
      if (!canEdit) return;
      const feedback = document.getElementById('fileFeedback');
      feedback.textContent = '';
      const fileInput = document.getElementById('fileUploadInput');
      if (!fileInput.files.length) {
        feedback.textContent = 'Select a file to upload.';
        return;
      }
      const file = fileInput.files[0];
      const base64 = await fileToBase64(file);
      const payload = {
        name: file.name,
        mimeType: document.getElementById('fileMimeType').value || file.type,
        sizeBytes: file.size,
        base64,
        context: sanitizeContext(document.getElementById('fileContext')?.value)
      };
      try {
        await fetchJson(`/api/rooms/${state.roomId}/files`, { method: 'POST', body: JSON.stringify(payload) });
        feedback.textContent = 'File uploaded.';
        fileUploadForm.reset();
        await loadFiles();
      } catch (err) {
        feedback.textContent = err.message;
      }
    });
  }

  const fileCommentForm = document.getElementById('fileCommentForm');
  if (fileCommentForm) {
    fileCommentForm.addEventListener('submit', async e => {
      e.preventDefault();
      const feedback = document.getElementById('fileCommentFeedback');
      feedback.textContent = '';
      if (!state.selectedFileId) {
        feedback.textContent = 'Select a file first.';
        return;
      }
      const body = document.getElementById('fileCommentBody').value;
      if (!body.trim()) return;
      try {
        await fetchJson(`/api/rooms/${state.roomId}/files/${state.selectedFileId}/comments`, {
          method: 'POST',
          body: JSON.stringify({ body })
        });
        document.getElementById('fileCommentBody').value = '';
        await loadFileDetails(state.selectedFileId);
        feedback.textContent = 'Comment added.';
      } catch (err) {
        feedback.textContent = err.message;
      }
    });
  }

  const fileValidate = document.getElementById('fileValidate');
  if (fileValidate) {
    fileValidate.addEventListener('click', async () => {
      if (!canEdit || !state.selectedFileId) return;
      const feedback = document.getElementById('validationFeedback');
      feedback.textContent = '';
      const context = document.getElementById('fileValidationContext').value;
      try {
        const res = await fetchJson(`/api/rooms/${state.roomId}/files/${state.selectedFileId}/validate`, {
          method: 'POST',
          body: JSON.stringify({ context })
        });
        feedback.textContent = `Summary: ${res.validation?.summary || 'Completed'}`;
      } catch (err) {
        feedback.textContent = err.message;
      }
    });
  }

  const memberForm = document.getElementById('memberForm');
  if (memberForm) {
    memberForm.addEventListener('submit', async e => {
      e.preventDefault();
      if (!isAdmin) return;
      const feedback = document.getElementById('memberFeedback');
      feedback.textContent = '';
      const selectedUser = document.querySelector('#memberOptions option[value="' + memberSearch.value + '"]');
      const userId = selectedUser ? selectedUser.dataset.userId : null;
      if (!userId) {
        feedback.textContent = state.isGuest ? 'Guests cannot search the directory.' : 'Select a user from the directory.';
        return;
      }
      const payload = {
        userId,
        organization: document.getElementById('memberOrg').value,
        role: document.getElementById('memberRole').value
      };
      try {
        await fetchJson(`/api/rooms/${state.roomId}/members`, { method: 'POST', body: JSON.stringify(payload) });
        feedback.textContent = 'Member added.';
        await loadMembers();
      } catch (err) {
        feedback.textContent = err.message;
      }
    });
  }

  const inviteForm = document.getElementById('inviteForm');
  if (inviteForm) {
    inviteForm.addEventListener('submit', async e => {
      e.preventDefault();
      if (!isAdmin) return;
      const feedback = document.getElementById('inviteFeedback');
      feedback.textContent = '';
      const payload = {
        email: document.getElementById('inviteEmail').value,
        organization: document.getElementById('inviteOrg').value,
        role: document.getElementById('inviteRole').value,
        isGuestInvite: document.getElementById('inviteGuest').checked
      };
      try {
        await fetchJson(`/api/rooms/${state.roomId}/invites`, { method: 'POST', body: JSON.stringify(payload) });
        feedback.textContent = 'Invite sent.';
        inviteForm.reset();
        await loadInvites();
      } catch (err) {
        feedback.textContent = err.message;
      }
    });
  }

  if (assigneeSearch && !state.isGuest) {
    assigneeSearch.addEventListener('input', debounce(async () => {
      await populateUserSearch(assigneeSearch.value, 'assigneeOptions');
    }, 200));
  }
  const addAssigneeButton = document.getElementById('addAssigneeButton');
  if (addAssigneeButton) {
    addAssigneeButton.addEventListener('click', () => {
      const selectedOption = document.querySelector('#assigneeOptions option[value="' + assigneeSearch.value + '"]');
      const id = selectedOption ? selectedOption.dataset.userId : null;
      if (id && !state.assignees.includes(id)) {
        state.assignees.push(id);
        renderAssignees();
      }
    });
  }

  if (memberSearch && !state.isGuest) {
    memberSearch.addEventListener('input', debounce(async () => {
      await populateUserSearch(memberSearch.value, 'memberOptions');
    }, 200));
  }
}

async function populateUserSearch(query, datalistId) {
  const list = document.getElementById(datalistId);
  if (!list) return;
  if (state.isGuest) return;
  try {
    const res = await fetchJson(`/api/org/users/search?q=${encodeURIComponent(query || '')}`);
    list.innerHTML = '';
    res.users.forEach(user => {
      const opt = document.createElement('option');
      opt.value = `${user.name || user.email} (${user.email})`;
      opt.dataset.userId = user.id;
      list.appendChild(opt);
    });
  } catch (err) {
    list.innerHTML = '';
  }
}

function renderAssignees() {
  const container = document.getElementById('assigneePills');
  if (!container) return;
  container.innerHTML = '';
  state.assignees.forEach(id => {
    const span = document.createElement('span');
    span.className = 'badge-soft';
    span.textContent = id;
    container.appendChild(span);
  });
}

function renderList(containerId, items, renderer, emptyText) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'text-fg-3 small';
    empty.textContent = emptyText;
    container.appendChild(empty);
    return;
  }
  items.forEach(item => {
    const row = document.createElement('div');
    row.className = 'glass-subtle p-2';
    row.innerHTML = renderer(item);
    container.appendChild(row);
  });
}

function renderMessageRow(msg) {
  const author = msg.author || (msg.type === 'system' ? 'System' : 'Update');
  const ts = msg.createdAt ? new Date(msg.createdAt).toLocaleString() : '';
  return `
    <div class="d-flex justify-content-between align-items-center mb-1">
      <div class="fw-semibold">${author}</div>
      <div class="d-flex gap-2 align-items-center small text-fg-3">${renderContextBadge(msg.context)}<span>${ts}</span></div>
    </div>
    <div>${msg.body}</div>
  `;
}

function renderIssueRow(issue) {
  const due = issue.dueDate ? new Date(issue.dueDate).toLocaleDateString() : 'n/a';
  const assigneeCount = issue.assignees?.length || 0;
  return `
    <div class="d-flex justify-content-between align-items-center mb-1">
      <div class="fw-semibold">${issue.title}</div>
      <div class="d-flex gap-2 align-items-center">${renderContextBadge(issue.context)}<span class="badge-soft">${issue.status}</span></div>
    </div>
    <div class="text-fg-3 small mb-1">Priority: ${issue.priority || 'medium'} • Due: ${due}</div>
    <div class="small">Assignees: ${assigneeCount}</div>
    <div class="text-fg-3 small">${issue.description || issue.notes || ''}</div>
  `;
}

function renderDeliverableRow(deliverable) {
  const due = deliverable.dueDate ? new Date(deliverable.dueDate).toLocaleDateString() : 'n/a';
  return `
    <div class="d-flex justify-content-between align-items-center mb-1">
      <div class="fw-semibold">${deliverable.title}</div>
      <div class="d-flex gap-2 align-items-center">${renderContextBadge(deliverable.context)}<span class="badge-soft">${deliverable.status}</span></div>
    </div>
    <div class="text-fg-3 small mb-1">Owner: ${lookupMember(deliverable.owner)}</div>
    <div class="text-fg-3 small mb-1">Due: ${due}</div>
    <div class="small">Related issues: ${deliverable.relatedIssues?.length || 0}</div>
    <div class="text-fg-3 small">${deliverable.description || ''}</div>
  `;
}

function renderFileRow(file) {
  const updated = file.updatedAt ? new Date(file.updatedAt).toLocaleString() : 'n/a';
  const sizeKb = (file.currentVersion?.sizeBytes || file.sizeBytes || 0) / 1000;
  return `
    <div class="d-flex justify-content-between align-items-start mb-1">
      <div>
        <div class="fw-semibold">${file.name}</div>
        <div class="text-fg-3 small">${file.mimeType || 'file'} • ${sizeKb.toFixed(1)} KB</div>
      </div>
      ${renderContextBadge(file.context)}
    </div>
    <div class="d-flex justify-content-between align-items-center small text-fg-3">
      <span>Updated ${updated}</span>
      <button class="btn btn-outline-light btn-sm" data-file-id="${file.id}">View</button>
    </div>
  `;
}

async function loadMessages() {
  try {
    const res = await fetchJson(`/api/rooms/${state.roomId}/messages`);
    const visible = (res.messages || []).filter(msg => isContextVisible(msg.context));
    const groups = groupByContext(visible);
    setText('messageCount', visible.length);
    setText('sharedMessageCount', groups.shared.length);
    setText('sellerMessageCount', groups.seller_only.length);
    setText('buyerMessageCount', groups.buyer_only.length);
    renderList('sharedMessageList', groups.shared, renderMessageRow, 'No shared messages yet.');
    renderList('sellerMessageList', groups.seller_only, renderMessageRow, 'No seller-only updates.');
    renderList('buyerMessageList', groups.buyer_only, renderMessageRow, 'No buyer-only updates.');
  } catch (err) {
    setText('messageFeedback', err.message);
  }
}

async function loadIssues() {
  try {
    const res = await fetchJson(`/api/rooms/${state.roomId}/issues`);
    const visible = (res.issues || []).filter(issue => isContextVisible(issue.context));
    state.issues = visible;
    setText('issueCount', visible.length);
    populateDeliverableIssueOptions();
    const groups = groupByContext(visible);
    setText('sharedIssueCount', groups.shared.length);
    setText('sellerIssueCount', groups.seller_only.length);
    setText('buyerIssueCount', groups.buyer_only.length);
    renderList('sharedIssueList', groups.shared, renderIssueRow, 'No shared issues.');
    renderList('sellerIssueList', groups.seller_only, renderIssueRow, 'No seller-side issues.');
    renderList('buyerIssueList', groups.buyer_only, renderIssueRow, 'No buyer-side issues.');
  } catch (err) {
    setText('issueFeedback', err.message);
  }
}

async function loadDeliverables() {
  try {
    const res = await fetchJson(`/api/rooms/${state.roomId}/deliverables`);
    const visible = (res.deliverables || []).filter(deliverable => isContextVisible(deliverable.context));
    state.deliverables = visible;
    setText('deliverableCount', visible.length);
    const groups = groupByContext(visible);
    setText('sharedDeliverableCount', groups.shared.length);
    setText('sellerDeliverableCount', groups.seller_only.length);
    setText('buyerDeliverableCount', groups.buyer_only.length);
    renderList('sharedDeliverableList', groups.shared, renderDeliverableRow, 'No shared deliverables.');
    renderList('sellerDeliverableList', groups.seller_only, renderDeliverableRow, 'No seller deliverables.');
    renderList('buyerDeliverableList', groups.buyer_only, renderDeliverableRow, 'No buyer deliverables.');
  } catch (err) {
    setText('deliverableFeedback', err.message);
  }
}

async function loadFiles() {
  try {
    const res = await fetchJson(`/api/rooms/${state.roomId}/files`);
    const visible = (res.files || []).filter(file => isContextVisible(file.context));
    state.files = visible;
    setText('fileCount', visible.length);
    const groups = groupByContext(visible);
    setText('sharedFileCount', groups.shared.length);
    setText('sellerFileCount', groups.seller_only.length);
    setText('buyerFileCount', groups.buyer_only.length);
    renderList('sharedFileList', groups.shared, renderFileRow, 'No shared documents.');
    renderList('sellerFileList', groups.seller_only, renderFileRow, 'No seller documents.');
    renderList('buyerFileList', groups.buyer_only, renderFileRow, 'No buyer documents.');
    document.querySelectorAll('[data-file-id]').forEach(button => {
      button.addEventListener('click', () => loadFileDetails(button.getAttribute('data-file-id')));
    });
  } catch (err) {
    setText('fileFeedback', err.message);
  }
}

async function loadFileDetails(fileId) {
  try {
    state.selectedFileId = fileId;
    const res = await fetchJson(`/api/rooms/${state.roomId}/files/${fileId}`);
    if (!isContextVisible(res.file?.context)) {
      state.selectedFileId = null;
      setText('fileFeedback', 'This file is restricted to another persona.');
      return;
    }
    const details = document.getElementById('fileDetails');
    if (!details) return;
    details.hidden = false;
    setText('fileDetailTitle', res.file.name);
    setText('fileDetailMeta', `${res.file.mimeType || 'file'} • ${(res.file.currentVersion?.sizeBytes || 0) / 1000} KB`);
    const feedback = document.getElementById('fileFeedback');
    if (feedback) feedback.textContent = '';
    const download = document.getElementById('fileDownload');
    if (download) download.href = `/api/rooms/${state.roomId}/files/${fileId}/download`;
    const versions = document.getElementById('fileVersions');
    versions.innerHTML = '';
    res.versions.forEach(version => {
      const li = document.createElement('li');
      li.className = 'text-fg-3 small';
      li.textContent = `${new Date(version.createdAt).toLocaleString()} • ${version.sizeBytes} bytes`;
      versions.appendChild(li);
    });
    const comments = document.getElementById('fileComments');
    comments.innerHTML = '';
    res.comments.forEach(comment => {
      const c = document.createElement('div');
      c.className = 'card glass p-2';
      c.innerHTML = `<div class="text-fg-3 small">${new Date(comment.createdAt).toLocaleString()}</div><div>${comment.body}</div>`;
      comments.appendChild(c);
    });
  } catch (err) {
    setText('fileFeedback', err.message);
  }
}

async function loadMembers() {
  try {
    const res = await fetchJson(`/api/rooms/${state.roomId}/members`);
    state.members = res.members;
    setText('memberCount', res.members.length);
    populateMemberLists();
    const list = document.getElementById('memberList');
    if (!list) return;
    list.innerHTML = '';
    res.members.forEach(member => {
      const row = document.createElement('div');
      row.className = 'card glass p-2';
      row.innerHTML = `
        <div class="d-flex justify-content-between align-items-center">
          <div>
            <div class="fw-semibold">${member.name || member.email || 'User'}</div>
            <div class="text-fg-3 small">${member.email || ''} • ${member.organization || ''}</div>
          </div>
          <div class="d-flex gap-2 align-items-center">
            <span class="badge-soft">${member.role}</span>
            ${member.isGuest ? '<span class="badge-soft">Guest</span>' : ''}
          </div>
        </div>
      `;
      list.appendChild(row);
    });
  } catch (err) {
    setText('memberFeedback', err.message);
  }
}

async function loadInvites() {
  try {
    const membership = state.roomMembership || state.room?.yourMembership || state.room?.membership;
    const isAdmin = membership?.role === 'room_admin' && membership?.isGuest !== true;
    if (!isAdmin) return;
    const res = await fetchJson(`/api/rooms/${state.roomId}/invites`);
    const list = document.getElementById('inviteList');
    if (!list) return;
    list.innerHTML = '';
    res.invites.forEach(invite => {
      const card = document.createElement('div');
      card.className = 'card glass p-2';
      card.innerHTML = `
        <div class="d-flex justify-content-between align-items-center">
          <div>
            <div class="fw-semibold">${invite.email}</div>
            <div class="text-fg-3 small">${invite.organization}</div>
          </div>
          <div class="d-flex gap-2 align-items-center">
            <span class="badge-soft">${invite.role}</span>
            <span class="badge-soft">${invite.status}</span>
            ${invite.isGuestInvite ? '<span class="badge-soft">Guest</span>' : ''}
          </div>
        </div>
      `;
      list.appendChild(card);
    });
  } catch (err) {
    setText('inviteFeedback', err.message);
  }
}

function populateMemberLists() {
  const ownerSelect = document.getElementById('deliverableOwner');
  if (ownerSelect) {
    ownerSelect.innerHTML = '';
    state.members.forEach(member => {
      const opt = document.createElement('option');
      opt.value = member.userId;
      opt.textContent = member.name || member.email || member.userId;
      ownerSelect.appendChild(opt);
    });
  }
}

function populateDeliverableIssueOptions() {
  const select = document.getElementById('deliverableIssues');
  if (!select) return;
  select.innerHTML = '';
  state.issues.forEach(issue => {
    const opt = document.createElement('option');
    opt.value = issue.id;
    opt.textContent = issue.title;
    select.appendChild(opt);
  });
}

function bindAiActions() {
  const summaryButton = document.getElementById('aiRoomSummaryButton');
  const statusButton = document.getElementById('aiStatusReportButton');
  if (summaryButton && summaryButton.dataset.bound !== 'true') {
    summaryButton.dataset.bound = 'true';
    summaryButton.addEventListener('click', () => triggerAiSummary());
  }
  if (statusButton && statusButton.dataset.bound !== 'true') {
    statusButton.dataset.bound = 'true';
    statusButton.addEventListener('click', () => triggerAiStatusReport());
  }
}

async function triggerAiSummary() {
  setAiInsightsStatus('Generating summary...');
  try {
    const res = await fetchJson(`/api/rooms/${state.roomId}/ai/summary`, {
      method: 'POST',
      body: JSON.stringify({ timeWindowHours: 24 })
    });
    renderAiSummary(res);
    setAiInsightsStatus('Summary ready');
  } catch (err) {
    renderAiError(err.message || 'Unable to generate summary');
  }
}

async function triggerAiStatusReport() {
  setAiInsightsStatus('Generating status...');
  try {
    const res = await fetchJson(`/api/rooms/${state.roomId}/ai/status-report`, {
      method: 'POST',
      body: JSON.stringify({ audience: 'joint', includeDetails: true })
    });
    renderAiStatus(res);
    setAiInsightsStatus('Status ready');
  } catch (err) {
    renderAiError(err.message || 'Unable to generate status');
  }
}

function renderAiSummary(data) {
  const body = document.getElementById('aiInsightsBody');
  const title = document.getElementById('aiInsightsTitle');
  if (!body || !title) return;
  title.textContent = 'AI room summary';
  const highlights = (data.highlights || []).map(item => `<li>${item}</li>`).join('');
  const risks = (data.risks || []).map(item => `<li>${item}</li>`).join('');
  const nextSteps = (data.nextSteps || []).map(item => `<li>${item}</li>`).join('');
  body.innerHTML = `
    <p class="mb-2">${data.summary || 'AI summary generated.'}</p>
    ${highlights ? `<div class="mb-2"><strong>Highlights</strong><ul class="mb-0">${highlights}</ul></div>` : ''}
    ${risks ? `<div class="mb-2"><strong>Risks</strong><ul class="mb-0">${risks}</ul></div>` : ''}
    ${nextSteps ? `<div class="mb-0"><strong>Next steps</strong><ul class="mb-0">${nextSteps}</ul></div>` : ''}
  `;
}

function renderAiStatus(data) {
  const body = document.getElementById('aiInsightsBody');
  const title = document.getElementById('aiInsightsTitle');
  if (!body || !title) return;
  title.textContent = 'AI status report';
  const actions = (data.recommendedActions || []).map(item => `<li>${item}</li>`).join('');
  body.innerHTML = `
    <p class="mb-2 fw-semibold">${data.headline || 'Status update'}</p>
    <div class="mb-2">Overall status: <strong>${data.overallStatus || 'unknown'}</strong></div>
    ${actions ? `<div><strong>Recommended actions</strong><ul class="mb-0">${actions}</ul></div>` : ''}
  `;
}

function setAiInsightsStatus(text) {
  setText('aiInsightsStatus', text || 'Idle');
}

function renderAiError(message) {
  const body = document.getElementById('aiInsightsBody');
  if (body) body.textContent = message || 'Unable to complete AI request';
  setAiInsightsStatus('Error');
}

function populateOrgSelectors() {
  const orgOptions = [
    { id: state.room?.vendorOrg, label: `Vendor: ${state.room?.vendorOrg || ''}` },
    { id: state.room?.buyerOrg, label: `Buyer: ${state.room?.buyerOrg || ''}` }
  ].filter(org => org.id);
  const memberOrg = document.getElementById('memberOrg');
  const inviteOrg = document.getElementById('inviteOrg');
  [memberOrg, inviteOrg].forEach(select => {
    if (!select) return;
    select.innerHTML = '';
    orgOptions.forEach(org => {
      const opt = document.createElement('option');
      opt.value = org.id;
      opt.textContent = org.label;
      select.appendChild(opt);
    });
  });
}

async function initRoomInvitePage() {
  const status = document.getElementById('roomInviteStatus');
  if (!status) return;
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  if (!token) {
    status.textContent = 'No invite token provided.';
    return;
  }
  try {
    status.textContent = 'Accepting invite...';
    const res = await fetchJson(`/api/room-invites/${encodeURIComponent(token)}/accept`, { method: 'POST' });
    const roomId = res.roomId || res.room?.id;
    if (roomId) {
      window.location.href = `/room.html?id=${roomId}`;
    } else {
      status.textContent = 'Invite accepted, redirecting...';
      window.location.href = '/rooms.html';
    }
  } catch (err) {
    status.textContent = err.message || 'Unable to accept invite.';
  }
}

function lookupMember(userId) {
  const member = state.members.find(m => m.userId === userId);
  return member ? member.name || member.email || member.userId : 'Unassigned';
}

function debounce(fn, delay) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result || '';
      const base64 = result.toString().split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function subscribeToRoomEvents(roomId) {
  if (state.eventsInterval) {
    clearInterval(state.eventsInterval);
    state.eventsInterval = null;
  }
  if (!roomId) return;
  const poll = async () => {
    try {
      await Promise.all([loadMessages(), loadIssues(), loadDeliverables(), loadFiles()]);
    } catch (err) {
      console.warn('Room event poll failed', err.message);
    }
  };
  state.eventsInterval = setInterval(poll, 8000);
}
