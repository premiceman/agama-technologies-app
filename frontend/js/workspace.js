const workspaceState = {
  context: null,
  overview: null
};

// QA checklist:
// - Vendor-only users: only vendor tiles render, buyer/shared sections remain hidden.
// - Buyer-only users: only buyer tiles render with buyer theme applied.
// - Dual persona users: all entitled tiles render with correct counts and theme pills.

function setTextContent(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function toggleVisibility(element, visible) {
  if (!element) return;
  element.classList.toggle('d-none', !visible);
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }
  const data = await res.json();
  if (data.error) {
    throw new Error(data.error);
  }
  return data;
}

function applyTheme(themeHints) {
  const theme = themeHints?.primary;
  if (theme === 'buyer') {
    document.body.dataset.theme = 'buyer';
    return;
  }
  if (theme === 'shared') {
    document.body.dataset.theme = 'shared';
    return;
  }
  document.body.dataset.theme = 'seller';
}

function renderHeader(context) {
  const name = context?.user?.name || context?.user?.email || 'Workspace';
  setTextContent('workspaceGreeting', `Hi ${name}, your control tower is ready.`);

  const org = context?.activeOrganization;
  if (org) {
    const role = org.role ? org.role.toUpperCase() : 'MEMBER';
    setTextContent('orgContext', `${org.name} • ${role}`);
  } else {
    setTextContent('orgContext', 'No active organization context.');
  }

  const persona = context?.activePersona || 'shared';
  setTextContent('personaPill', `Persona: ${persona}`);
  applyTheme(context?.themeHints);
}

function initGlobalSearch() {
  const input = document.getElementById('globalSearchInput');
  const results = document.getElementById('globalSearchResults');
  if (input && results && window.SearchUI) {
    window.SearchUI.bindSearchField({ input, resultsContainer: results, contextLabel: 'Workspace scope' });
  }
}

function renderVendorSection(overview, entitlements) {
  const section = document.getElementById('vendorSection');
  const allowed = Boolean(entitlements?.vendorSuite && overview?.vendor);
  toggleVisibility(section, allowed);
  if (!allowed) return;

  const vendor = overview.vendor;
  setTextContent('metricSellerAccounts', vendor?.revenueAccounts?.total ?? 0);
  setTextContent('metricSellerAssessments', vendor?.valueSphere?.sellerAssessments ?? 0);
}

function renderBuyerSection(overview, entitlements) {
  const section = document.getElementById('buyerSection');
  const allowed = Boolean(entitlements?.buyerSuite && overview?.buyer);
  toggleVisibility(section, allowed);
  if (!allowed) return;

  const buyer = overview.buyer;
  setTextContent('metricBuyerVendors', buyer?.procurementVendors?.total ?? 0);
  setTextContent('metricBuyerAssessments', buyer?.valueSphere?.buyerAssessments ?? 0);
}

function renderSharedSection(overview, entitlements) {
  const section = document.getElementById('sharedSection');
  const allowed = Boolean(entitlements?.sharedSuite && overview?.shared);
  toggleVisibility(section, allowed);
  if (!allowed) return;

  const shared = overview.shared;
  setTextContent('metricRooms', shared?.engagementRooms?.total ?? 0);
}

function renderDashboard() {
  const overview = workspaceState.overview || {};
  const entitlements = workspaceState.context?.suiteEntitlements || {};
  renderVendorSection(overview, entitlements);
  renderBuyerSection(overview, entitlements);
  renderSharedSection(overview, entitlements);
}

function showError(message) {
  const alert = document.getElementById('statusMessage');
  if (!alert) return;
  alert.textContent = message;
  alert.classList.remove('d-none');
}

function clearError() {
  const alert = document.getElementById('statusMessage');
  if (!alert) return;
  alert.textContent = '';
  alert.classList.add('d-none');
}

async function loadWorkspace() {
  try {
    clearError();
    const context = await fetchJson('/api/me/context');
    const { accessState } = context || {};
    if (accessState === 'needs_onboarding') {
      window.location.href = '/onboarding.html';
      return;
    }
    workspaceState.context = context;
    renderHeader(context);

    const overviewResponse = await fetchJson('/api/dashboard/overview');
    workspaceState.overview = overviewResponse.overview || {};
    renderDashboard();
  } catch (err) {
    console.error('Workspace error', err);
    showError(err.message || 'Unable to load workspace.');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const refreshButton = document.getElementById('refreshButton');
  if (refreshButton) {
    refreshButton.addEventListener('click', () => loadWorkspace());
  }
  initGlobalSearch();
  loadWorkspace();
});
