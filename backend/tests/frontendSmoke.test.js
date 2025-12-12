process.env.NODE_ENV = 'test';

const path = require('path');

function createElement(id) {
  return {
    id,
    textContent: '',
    value: '',
    innerHTML: '',
    classList: {
      classes: new Set(),
      toggle(cls, force) {
        if (force === false) {
          this.classes.delete(cls);
        } else {
          this.classes.add(cls);
        }
      },
      add(cls) {
        this.classes.add(cls);
      },
      remove(cls) {
        this.classes.delete(cls);
      },
      contains(cls) {
        return this.classes.has(cls);
      }
    },
    dataset: {},
    setAttribute() {},
    appendChild() {},
    querySelectorAll() { return []; },
    closest() { return null; },
    addEventListener() {}
  };
}

function buildStubDom(extraIds = []) {
  const listeners = {};
  const elements = {};
  const ids = ['workspaceGreeting', 'orgContext', 'personaPill', 'statusMessage', 'profileFeedback', 'homeOrg'].concat(extraIds);
  ids.forEach(id => {
    elements[id] = createElement(id);
  });

  const document = {
    body: createElement('body'),
    documentElement: createElement('html'),
    addEventListener(event, handler) {
      listeners[event] = listeners[event] || [];
      listeners[event].push(handler);
    },
    dispatchEvent(evt) {
      const cbs = listeners[evt.type] || [];
      cbs.forEach(cb => cb(evt));
    },
    getElementById(id) {
      return elements[id] || null;
    },
    querySelectorAll() {
      return [];
    },
    createElement(tag) {
      return createElement(tag);
    }
  };

  return { document, elements, listeners };
}

function resetModule(modulePath) {
  try {
    delete require.cache[require.resolve(modulePath)];
  } catch (err) {
    // ignore
  }
}

describe('Frontend smoke tests without org data', () => {
  afterEach(() => {
    delete global.fetch;
    delete global.window;
    delete global.document;
  });

  test('workspace page renders with minimal login context', async () => {
    const { document, elements } = buildStubDom(['globalSearchInput', 'globalSearchResults']);
    const fetchCalls = [];
    const window = { document, navigator: {}, SearchUI: null };

    global.document = document;
    global.window = window;

    global.fetch = async url => {
      fetchCalls.push(url);
      if (url === '/api/me/context') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            user: { name: 'Workspace User', email: 'workspace@example.com' },
            activeOrg: null,
            organizationContext: null,
            themeHint: 'shared',
            suiteEntitlements: { effective: { vendorSuite: false, buyerSuite: false, sharedSuite: true } }
          })
        };
      }
      if (url === '/api/dashboard/overview') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ overview: { shared: { engagementRooms: { total: 0 } } } })
        };
      }
      throw new Error(`Unexpected fetch: ${url}`);
    };

    const workspaceScript = path.join(__dirname, '..', 'public', 'js', 'workspace.js');
    resetModule(workspaceScript);
    require(workspaceScript);

    document.dispatchEvent({ type: 'DOMContentLoaded' });
    await new Promise(resolve => setTimeout(resolve, 5));

    expect(elements.orgContext.textContent).toBe('No active organization context.');
    expect(fetchCalls).toEqual(['/api/me/context', '/api/dashboard/overview']);
  });

  test('profile page redirects to login when session is missing', async () => {
    const { document } = buildStubDom();
    let redirectedTo = null;
    const window = {
      document,
      navigator: {},
      location: {
        set href(value) {
          redirectedTo = value;
        },
        get href() {
          return redirectedTo;
        }
      }
    };

    global.window = window;
    global.document = document;

    global.fetch = async () => ({ status: 401, ok: false, json: async () => ({}) });

    const profileScript = path.join(__dirname, '..', 'public', 'js', 'profile.js');
    resetModule(profileScript);
    require(profileScript);

    document.dispatchEvent({ type: 'DOMContentLoaded' });
    await new Promise(resolve => setTimeout(resolve, 5));

    expect(redirectedTo).toBe('/api/auth/workos/login');
  });
});
