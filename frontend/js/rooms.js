const state = {
  orgContext: null,
  user: null,
  effectiveLicenseTier: null,
  isGuest: false,
  organizations: [],
  roomId: null,
  room: null,
  members: [],
  issues: [],
  deliverables: [],
  files: [],
  selectedFileId: null,
  assignees: []
};

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
  const tier = state.effectiveLicenseTier || state.orgContext?.tier || state.user?.licenseTier || 'personal';
  if (state.isGuest) return { allowed: true };
  if (tier === 'business') return { allowed: true };
  return {
    allowed: false,
    reason:
      'Engagement Rooms are part of Agama Business workspaces. Talk to us to switch it on and unify every buyer conversation.'
  };
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

document.addEventListener('DOMContentLoaded', () => {
  const roomsList = document.getElementById('roomsList');
  const roomTitle = document.getElementById('roomTitle');
  const inviteStatus = document.getElementById('roomInviteStatus');

  if (roomsList) {
    initRoomsPage();
  }

  if (roomTitle) {
    initRoomDetailPage();
  }

  if (inviteStatus) {
    initRoomInvitePage();
  }

  const logoutButton = document.getElementById('logoutButton');
  if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login.html';
    });
  }
});

async function initRoomsPage() {
  try {
    const orgResp = await fetchJson('/api/org/current');
    state.orgContext = orgResp.organization;
    state.user = orgResp.user;
    state.effectiveLicenseTier = orgResp.effectiveLicenseTier || orgResp.effectiveLicense?.tier;
    state.isGuest = orgResp.user?.licenseTier === 'guest';

    const entitlement = roomsEntitlement();
    if (!entitlement.allowed) {
      renderRoomsLanding(entitlement);
      return;
    }

    const orgsResp = await fetchJson('/api/orgs');
    state.organizations = orgsResp.organizations || [];
    const licenseTier = state.effectiveLicenseTier || orgResp.user?.licenseTier || 'personal';
    setText('licenseBadge', licenseLabel(licenseTier));
    setText(
      'roomsOrgContext',
      state.orgContext ? `${state.orgContext.name} • ${state.orgContext.orgType || 'multi-org'}` : 'No organization selected'
    );
    setupCreateRoomHandlers();
    const roomsResp = await fetchJson('/api/rooms');
    renderRooms(roomsResp.rooms || []);
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
    const buyerOrg = document.getElementById('createRoomBuyerOrg')?.value;
    if (!title) {
      if (feedback) feedback.textContent = 'Title is required.';
      return;
    }
    if (!vendorOrg || !buyerOrg) {
      if (feedback) feedback.textContent = 'Select both vendor and buyer organizations.';
      return;
    }
    if (vendorOrg === buyerOrg) {
      if (feedback) feedback.textContent = 'Vendor and buyer must be different organizations.';
      return;
    }

    try {
      const res = await fetchJson('/api/rooms', {
        method: 'POST',
        body: JSON.stringify({ title, vendorOrg, buyerOrg })
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

    const emptyBuyer = document.createElement('option');
    emptyBuyer.textContent = 'No organizations available';
    emptyBuyer.disabled = true;
    emptyBuyer.selected = true;
    buyerSelect.appendChild(emptyBuyer);
    return;
  }
  state.organizations.forEach(org => {
    const vendorOpt = document.createElement('option');
    vendorOpt.value = org.id;
    vendorOpt.textContent = org.name;
    vendorSelect.appendChild(vendorOpt);

    const buyerOpt = document.createElement('option');
    buyerOpt.value = org.id;
    buyerOpt.textContent = org.name;
    buyerSelect.appendChild(buyerOpt);
  });
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
    renderRoomHeader();
    configureOrgControls();
    bindAiActions();
    await Promise.all([loadMembers(), loadMessages(), loadIssues(), loadDeliverables(), loadFiles(), loadInvites()]);
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
          body: JSON.stringify({ body: bodyInput.value })
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
        assignees: state.assignees
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
        relatedIssues: Array.from(document.getElementById('deliverableIssues').selectedOptions).map(opt => opt.value)
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
        base64
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

async function loadMessages() {
  try {
    const res = await fetchJson(`/api/rooms/${state.roomId}/messages`);
    const list = document.getElementById('messageList');
    if (!list) return;
    list.innerHTML = '';
    setText('messageCount', res.messages.length);
    res.messages.forEach(msg => {
      const item = document.createElement('div');
      item.className = 'card glass p-3';
      item.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-1">
          <div class="fw-semibold">${msg.type === 'system' ? 'System' : 'Message'}</div>
          <div class="text-fg-3 small">${new Date(msg.createdAt).toLocaleString()}</div>
        </div>
        <div>${msg.body}</div>
      `;
      list.appendChild(item);
    });
  } catch (err) {
    setText('messageFeedback', err.message);
  }
}

async function loadIssues() {
  try {
    const res = await fetchJson(`/api/rooms/${state.roomId}/issues`);
    state.issues = res.issues;
    setText('issueCount', res.issues.length);
    populateDeliverableIssueOptions();
    const list = document.getElementById('issueList');
    if (!list) return;
    list.innerHTML = '';
    res.issues.forEach(issue => {
      const card = document.createElement('div');
      card.className = 'card glass p-3';
      card.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-1">
          <div class="fw-semibold">${issue.title}</div>
          <span class="badge-soft">${issue.status}</span>
        </div>
        <div class="text-fg-3 small mb-1">Priority: ${issue.priority || 'medium'} | Due: ${issue.dueDate ? new Date(issue.dueDate).toLocaleDateString() : 'n/a'}</div>
        <div class="small">Assignees: ${issue.assignees?.length || 0}</div>
        <div class="text-fg-3 small">${issue.description || ''}</div>
      `;
      list.appendChild(card);
    });
  } catch (err) {
    setText('issueFeedback', err.message);
  }
}

async function loadDeliverables() {
  try {
    const res = await fetchJson(`/api/rooms/${state.roomId}/deliverables`);
    state.deliverables = res.deliverables;
    setText('deliverableCount', res.deliverables.length);
    const list = document.getElementById('deliverableList');
    if (!list) return;
    list.innerHTML = '';
    res.deliverables.forEach(deliverable => {
      const card = document.createElement('div');
      card.className = 'card glass p-3';
      card.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-1">
          <div class="fw-semibold">${deliverable.title}</div>
          <span class="badge-soft">${deliverable.status}</span>
        </div>
        <div class="text-fg-3 small mb-1">Owner: ${lookupMember(deliverable.owner)}</div>
        <div class="text-fg-3 small mb-1">Due: ${deliverable.dueDate ? new Date(deliverable.dueDate).toLocaleDateString() : 'n/a'}</div>
        <div class="small">Related issues: ${deliverable.relatedIssues?.length || 0}</div>
        <div class="text-fg-3 small">${deliverable.description || ''}</div>
      `;
      list.appendChild(card);
    });
  } catch (err) {
    setText('deliverableFeedback', err.message);
  }
}

async function loadFiles() {
  try {
    const res = await fetchJson(`/api/rooms/${state.roomId}/files`);
    state.files = res.files;
    setText('fileCount', res.files.length);
    const list = document.getElementById('fileList');
    if (!list) return;
    list.innerHTML = '';
    res.files.forEach(file => {
      const col = document.createElement('div');
      col.className = 'col-md-6 col-xl-4';
      const card = document.createElement('div');
      card.className = 'card glass p-3 h-100';
      card.innerHTML = `
        <div class="fw-semibold mb-1">${file.name}</div>
        <div class="text-fg-3 small mb-2">${file.mimeType || 'file'} | ${(file.currentVersion?.sizeBytes || 0) / 1000} KB</div>
        <div class="d-flex justify-content-between align-items-center">
          <div class="small">Updated ${file.updatedAt ? new Date(file.updatedAt).toLocaleString() : 'n/a'}</div>
          <button class="btn btn-outline-light btn-sm" data-file-id="${file.id}">View</button>
        </div>
      `;
      card.querySelector('button').addEventListener('click', () => loadFileDetails(file.id));
      col.appendChild(card);
      list.appendChild(col);
    });
  } catch (err) {
    setText('fileFeedback', err.message);
  }
}

async function loadFileDetails(fileId) {
  try {
    state.selectedFileId = fileId;
    const res = await fetchJson(`/api/rooms/${state.roomId}/files/${fileId}`);
    const details = document.getElementById('fileDetails');
    if (!details) return;
    details.hidden = false;
    setText('fileDetailTitle', res.file.name);
    setText('fileDetailMeta', `${res.file.mimeType || 'file'} • ${(res.file.currentVersion?.sizeBytes || 0) / 1000} KB`);
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
