const state = {
  orgContext: null,
  isGuest: false,
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

function toggle(el, show) {
  if (!el) return;
  el.classList.toggle('d-none', !show);
  el.hidden = !show;
}

document.addEventListener('DOMContentLoaded', () => {
  const roomsList = document.getElementById('roomsList');
  const roomTitle = document.getElementById('roomTitle');

  if (roomsList) {
    initRoomsPage();
  }

  if (roomTitle) {
    initRoomDetailPage();
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
    state.isGuest = orgResp.user?.licenseTier === 'guest';
    setText('licenseBadge', state.isGuest ? 'Guest license' : 'Full member');
    setText(
      'roomsOrgContext',
      state.orgContext ? `${state.orgContext.name} • ${state.orgContext.orgType || 'multi-org'}` : 'No organization selected'
    );
    const roomsResp = await fetchJson('/api/rooms');
    renderRooms(roomsResp.rooms || []);
  } catch (err) {
    setText('roomsOrgContext', err.message || 'Unable to load rooms');
  }
}

function renderRooms(rooms) {
  const list = document.getElementById('roomsList');
  const empty = document.getElementById('roomsEmpty');
  if (!list) return;
  list.innerHTML = '';
  if (!rooms.length) {
    toggle(empty, true);
    return;
  }
  toggle(empty, false);

  rooms.forEach(room => {
    const col = document.createElement('div');
    col.className = 'col-md-6 col-xl-4';
    const card = document.createElement('div');
    card.className = 'card glass p-3 h-100';
    card.innerHTML = `
      <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
        <div>
          <h3 class="h6 mb-1">${room.title || 'Untitled room'}</h3>
          <div class="text-fg-3 small">Status: ${room.status || 'active'}</div>
        </div>
        <span class="badge-soft">${room.membership?.role || 'member'}</span>
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
    renderRoomHeader();
    configureOrgControls();
    await Promise.all([loadMembers(), loadMessages(), loadIssues(), loadDeliverables(), loadFiles(), loadInvites()]);
  } catch (err) {
    setText('roomMeta', err.message || 'Unable to load room');
  }
}

function renderRoomHeader() {
  setText('roomTitle', state.room?.title || 'Untitled room');
  const role = state.room?.membership?.role || 'viewer';
  setText('roomRole', role === 'room_admin' ? 'Room admin' : role);
  const meta = [];
  if (state.room?.vendorOrg) meta.push(`Vendor org: ${state.room.vendorOrg}`);
  if (state.room?.buyerOrg) meta.push(`Buyer org: ${state.room.buyerOrg}`);
  setText('roomMeta', meta.join(' • '));
}

function configureOrgControls() {
  const isAdmin = state.room?.membership?.role === 'room_admin';
  const canEdit = ['editor', 'room_admin'].includes(state.room?.membership?.role);

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

  if (state.isGuest) {
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
    const isAdmin = state.room?.membership?.role === 'room_admin';
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
