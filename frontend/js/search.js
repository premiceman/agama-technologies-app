const SEARCH_DEBOUNCE_MS = 240;

function debounce(fn, wait) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), wait);
  };
}

function formatEntityLabel(entityType) {
  switch (entityType) {
    case 'engagement_room':
      return 'Engagement room';
    case 'procurement_vendor':
      return 'ProcurePath vendor';
    case 'valuesphere_assessment':
      return 'ValueSphere assessment';
    case 'revenue_account':
      return 'Revenue account';
    default:
      return 'Workspace record';
  }
}

function resultHref(result) {
  const id = result?.entityId;
  if (!id) return null;
  switch (result.entityType) {
    case 'engagement_room':
      return `/engagement-room.html?id=${id}`;
    case 'procurement_vendor':
      return `/procurepath-tool.html?vendorId=${id}`;
    case 'valuesphere_assessment':
      return `/valuesphere-template-new.html?assessmentId=${id}`;
    case 'revenue_account':
      return `/revenueforge-account.html?id=${id}`;
    default:
      return null;
  }
}

function renderResults(container, results, contextLabel) {
  if (!container) return;
  container.innerHTML = '';

  if (!results || results.length === 0) {
    container.innerHTML = `<div class="search-result muted">No results yet. Refine your query.</div>`;
    return;
  }

  results.forEach((result) => {
    const link = resultHref(result);
    const wrapper = document.createElement(link ? 'a' : 'div');
    wrapper.className = 'search-result d-flex align-items-start gap-3';
    if (link) {
      wrapper.href = link;
    }

    const badges = document.createElement('div');
    badges.className = 'd-flex align-items-center gap-2 flex-wrap';

    const typeBadge = document.createElement('span');
    typeBadge.className = 'badge-soft';
    typeBadge.textContent = formatEntityLabel(result.entityType);
    badges.appendChild(typeBadge);

    if (result.visibility) {
      const visibility = document.createElement('span');
      visibility.className = `theme-pill ${result.visibility === 'shared' ? 'shared' : result.visibility === 'buyer_only' ? 'buyer' : 'seller'}`;
      visibility.textContent = result.visibility.replace('_', ' ');
      badges.appendChild(visibility);
    }

    const title = document.createElement('div');
    title.className = 'fw-semibold';
    title.textContent = result.title || 'Untitled';

    const snippet = document.createElement('div');
    snippet.className = 'text-fg-3 small';
    snippet.textContent = result.snippet || 'No preview available';

    const body = document.createElement('div');
    body.className = 'flex-grow-1';
    body.appendChild(title);
    body.appendChild(snippet);
    body.appendChild(badges);

    wrapper.appendChild(body);

    if (contextLabel) {
      const context = document.createElement('span');
      context.className = 'badge-soft ms-auto';
      context.textContent = contextLabel;
      wrapper.appendChild(context);
    }

    container.appendChild(wrapper);
  });
}

async function executeSearch({ query, scope, filters }) {
  if (!query || query.trim().length < 2) return [];

  const params = new URLSearchParams({ q: query.trim() });
  if (scope) params.set('entityType', scope);
  if (filters && Object.keys(filters).length > 0) {
    params.set('filters', JSON.stringify(filters));
  }

  const res = await fetch(`/api/search?${params.toString()}`);
  if (!res.ok) {
    return [];
  }
  const data = await res.json();
  if (data.error) return [];
  return data.results || [];
}

function bindSearchField({ input, resultsContainer, scope, filters = {}, contextLabel }) {
  if (!input || !resultsContainer) return;

  const dropdown = resultsContainer.closest('.search-dropdown');
  const showDropdown = () => dropdown && dropdown.classList.remove('d-none');
  const hideDropdown = () => dropdown && dropdown.classList.add('d-none');

  const debouncedSearch = debounce(async (value) => {
    if (!value || value.trim().length < 2) {
      resultsContainer.innerHTML = '';
      hideDropdown();
      return;
    }
    const results = await executeSearch({ query: value, scope, filters });
    renderResults(resultsContainer, results, contextLabel);
    showDropdown();
  }, SEARCH_DEBOUNCE_MS);

  input.addEventListener('input', (event) => {
    debouncedSearch(event.target.value);
  });

  input.addEventListener('focus', () => {
    if (resultsContainer.children.length > 0) {
      showDropdown();
    }
  });

  document.addEventListener('click', (event) => {
    if (!resultsContainer.contains(event.target) && event.target !== input) {
      hideDropdown();
    }
  });
}

window.SearchUI = { bindSearchField };
