(function() {
  let csrfTokenPromise = null;

  async function fetchCsrfToken() {
    if (csrfTokenPromise) return csrfTokenPromise;
    csrfTokenPromise = window.fetch('/api/csrf-token', { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch CSRF token');
        return res.json();
      })
      .then(json => json.token)
      .catch(err => {
        csrfTokenPromise = null;
        throw err;
      });
    return csrfTokenPromise;
  }

  const originalFetch = window.fetch;
  window.fetch = async function patchedFetch(input, init = {}) {
    const request = input instanceof Request ? input : null;
    const method = (init.method || request?.method || 'GET').toUpperCase();
    let finalInit = init ? { ...init } : {};
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      const token = await fetchCsrfToken();
      const headers = new Headers(finalInit.headers || request?.headers || {});
      if (!headers.has('X-CSRF-Token')) {
        headers.set('X-CSRF-Token', token);
      }
      finalInit.headers = headers;
      if (!finalInit.credentials && !request?.credentials) {
        finalInit.credentials = 'include';
      }
    }
    if (!finalInit.credentials && request?.credentials) {
      finalInit.credentials = request.credentials;
    }
    return originalFetch.call(this, input, finalInit);
  };
})();
