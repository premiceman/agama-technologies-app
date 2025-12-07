const notificationState = {
  notifications: [],
  loaded: false,
  loading: false,
  lastError: ''
};

const notificationSelectors = {
  bell: 'notificationBell',
  badge: 'notificationUnreadBadge',
  dropdown: 'notificationDropdown',
  dropdownList: 'notificationDropdownList',
  dropdownEmpty: 'notificationDropdownEmpty',
  dropdownSummary: 'notificationDropdownSummary',
  markAll: 'notificationMarkAll',
  openPanel: 'notificationOpenPanel',
  panel: 'notificationPanel',
  panelBody: 'notificationPanelList',
  panelBackdrop: 'notificationPanelBackdrop',
  panelClose: 'notificationPanelClose',
  panelSummary: 'notificationPanelSummary',
  panelMarkAll: 'notificationPanelMarkAll'
};

function $(id) {
  return document.getElementById(id);
}

function ensureNotificationPanelMounted() {
  if ($(notificationSelectors.panel)) return;

  const panelMarkup = `
    <div class="agama-notification-panel-backdrop d-none" id="${notificationSelectors.panelBackdrop}"></div>
    <aside class="agama-notification-panel d-none" id="${notificationSelectors.panel}" aria-label="Notification panel">
      <div class="agama-notification-panel__header">
        <div>
          <span class="eyebrow d-block">Activity</span>
          <h2 class="h5 mb-1">Notifications</h2>
          <div class="text-fg-3" id="${notificationSelectors.panelSummary}">Recent updates from your suites</div>
        </div>
        <div class="d-flex align-items-center gap-2 flex-wrap">
          <button class="btn btn-outline-light btn-sm" type="button" id="${notificationSelectors.panelMarkAll}">Mark all read</button>
          <button class="btn btn-outline-light btn-sm" type="button" id="${notificationSelectors.panelClose}"><i class="bi bi-x"></i></button>
        </div>
      </div>
      <div class="agama-notification-panel__body" id="${notificationSelectors.panelBody}"></div>
    </aside>
  `;

  document.body.insertAdjacentHTML('beforeend', panelMarkup);
}

function formatRelativeTime(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function unreadCount() {
  return notificationState.notifications.filter(n => !n.read).length;
}

function setBadge(count) {
  const badge = $(notificationSelectors.badge);
  if (!badge) return;
  if (count > 0) {
    badge.textContent = String(count);
    badge.classList.remove('d-none');
  } else {
    badge.textContent = '0';
    badge.classList.add('d-none');
  }
}

function buildSnippet(notification) {
  const button = document.createElement('button');
  const unread = !notification.read;
  button.type = 'button';
  button.className = `agama-notification-snippet${unread ? ' is-unread' : ''}`;
  button.dataset.notificationId = notification._id || notification.id;
  const created = notification.createdAt ? formatRelativeTime(notification.createdAt) : '';
  button.innerHTML = `
    <div class="d-flex justify-content-between align-items-start gap-2">
      <div class="title">${notification.title || 'Notification'}</div>
      <div class="meta">${created}</div>
    </div>
    <div class="body">${notification.body || ''}</div>
  `;
  button.addEventListener('click', async () => {
    await markNotificationRead(notification._id || notification.id);
  });
  return button;
}

function buildPanelRow(notification) {
  const row = document.createElement('div');
  const unread = !notification.read;
  row.className = `agama-notification-row${unread ? ' is-unread' : ''}`;
  row.dataset.notificationId = notification._id || notification.id;
  const meta = notification.type ? notification.type.replace(/\./g, ' • ') : 'Update';
  const timestamp = notification.createdAt ? formatRelativeTime(notification.createdAt) : '';

  row.innerHTML = `
    <div class="agama-notification-dot" aria-hidden="true"></div>
    <div class="flex-grow-1">
      <div class="d-flex justify-content-between align-items-start gap-2 mb-1">
        <div class="agama-notification-title">${notification.title || 'Notification'}</div>
        <div class="text-fg-3 small">${timestamp}</div>
      </div>
      <div class="agama-notification-body">${notification.body || ''}</div>
      <div class="agama-notification-meta">
        <span class="badge-soft">${meta}</span>
        ${notification.readAt
          ? `<span class="text-fg-3">Read ${formatRelativeTime(notification.readAt)}</span>`
          : '<span class="text-fg-3">Unread</span>'}
      </div>
      ${unread ? '<div class="agama-notification-actions"><button class="btn btn-outline-light btn-sm" type="button" data-notification-action="mark-read">Mark read</button></div>' : ''}
    </div>
  `;

  const markReadBtn = row.querySelector('[data-notification-action="mark-read"]');
  if (markReadBtn) {
    markReadBtn.addEventListener('click', async event => {
      event.stopPropagation();
      await markNotificationRead(notification._id || notification.id);
    });
  }

  return row;
}

function renderDropdown() {
  const list = $(notificationSelectors.dropdownList);
  const empty = $(notificationSelectors.dropdownEmpty);
  const summary = $(notificationSelectors.dropdownSummary);
  if (!list || !empty) return;
  list.innerHTML = '';
  const notifications = notificationState.notifications.slice(0, 6);
  if (!notifications.length) {
    empty.classList.remove('d-none');
    if (summary) summary.textContent = notificationState.lastError || 'No notifications yet';
    return;
  }

  empty.classList.add('d-none');
  notifications.forEach(n => list.appendChild(buildSnippet(n)));
  if (summary) {
    const unread = unreadCount();
    summary.textContent = unread > 0 ? `${unread} unread update${unread === 1 ? '' : 's'}` : 'All caught up';
  }
}

function renderPanel() {
  ensureNotificationPanelMounted();
  const body = $(notificationSelectors.panelBody);
  const summary = $(notificationSelectors.panelSummary);
  if (!body) return;
  body.innerHTML = '';
  if (!notificationState.notifications.length) {
    const empty = document.createElement('div');
    empty.className = 'agama-notification-empty';
    empty.textContent = notificationState.lastError || 'No notifications yet. Room updates, ProcurePath events, and ValueSphere changes will appear here.';
    body.appendChild(empty);
    if (summary) summary.textContent = 'Waiting for new updates';
    return;
  }

  notificationState.notifications.forEach(n => body.appendChild(buildPanelRow(n)));
  if (summary) {
    const unread = unreadCount();
    summary.textContent = unread > 0 ? `${unread} unread` : 'All notifications read';
  }
}

async function fetchNotifications() {
  if (notificationState.loading) return;
  notificationState.loading = true;
  notificationState.lastError = '';
  try {
    const res = await fetch('/api/notifications');
    if (!res.ok) {
      throw new Error(`Unable to load notifications (${res.status})`);
    }
    const data = await res.json();
    const list = Array.isArray(data.notifications) ? data.notifications : [];
    notificationState.notifications = list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    notificationState.loaded = true;
    setBadge(unreadCount());
    renderDropdown();
    renderPanel();
  } catch (err) {
    console.error('Notification load error', err);
    notificationState.lastError = 'Unable to load notifications';
    setBadge(unreadCount());
    renderDropdown();
  } finally {
    notificationState.loading = false;
  }
}

async function markNotificationRead(id) {
  if (!id) return;
  try {
    const res = await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
    if (!res.ok) throw new Error('Unable to update notification');
    notificationState.notifications = notificationState.notifications.map(n =>
      (n._id === id || n.id === id) ? { ...n, read: true, readAt: n.readAt || new Date().toISOString() } : n
    );
    setBadge(unreadCount());
    renderDropdown();
    renderPanel();
  } catch (err) {
    console.error('Notification mark read error', err);
  }
}

async function markAllNotificationsRead() {
  try {
    const res = await fetch('/api/notifications/mark-all-read', { method: 'POST' });
    if (!res.ok) throw new Error('Unable to mark notifications');
    notificationState.notifications = notificationState.notifications.map(n => ({ ...n, read: true, readAt: n.readAt || new Date().toISOString() }));
    setBadge(0);
    renderDropdown();
    renderPanel();
  } catch (err) {
    console.error('Notification mark all error', err);
  }
}

function openPanel() {
  ensureNotificationPanelMounted();
  const panel = $(notificationSelectors.panel);
  const backdrop = $(notificationSelectors.panelBackdrop);
  if (panel) panel.classList.remove('d-none');
  if (backdrop) backdrop.classList.remove('d-none');
  renderPanel();
}

function closePanel() {
  const panel = $(notificationSelectors.panel);
  const backdrop = $(notificationSelectors.panelBackdrop);
  if (panel) panel.classList.add('d-none');
  if (backdrop) backdrop.classList.add('d-none');
}

function bindEvents() {
  const bell = $(notificationSelectors.bell);
  if (!bell) return;

  ensureNotificationPanelMounted();
  const openPanelButton = $(notificationSelectors.openPanel);
  const markAllButton = $(notificationSelectors.markAll);
  const panelClose = $(notificationSelectors.panelClose);
  const panelMarkAll = $(notificationSelectors.panelMarkAll);
  const backdrop = $(notificationSelectors.panelBackdrop);

  bell.addEventListener('click', () => {
    if (!notificationState.loaded) {
      fetchNotifications();
    }
  });

  bell.addEventListener('show.bs.dropdown', () => {
    fetchNotifications();
  });

  if (openPanelButton) {
    openPanelButton.addEventListener('click', () => {
      openPanel();
      const dropdownInstance = bootstrap.Dropdown.getInstance(bell);
      if (dropdownInstance) dropdownInstance.hide();
    });
  }

  if (markAllButton) {
    markAllButton.addEventListener('click', () => markAllNotificationsRead());
  }

  if (panelMarkAll) {
    panelMarkAll.addEventListener('click', () => markAllNotificationsRead());
  }

  if (panelClose) {
    panelClose.addEventListener('click', () => closePanel());
  }

  if (backdrop) {
    backdrop.addEventListener('click', () => closePanel());
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if ($(notificationSelectors.bell)) {
    bindEvents();
    fetchNotifications();
  }
});
