const modulePath = require.resolve('@workos-inc/node');

class FakeWorkOS {
  constructor() {
    this.userManagement = {
      authenticateWithCode: async () => FakeWorkOS.mockAuthResponse,
      getAuthorizationUrl: () => 'https://example.com/auth',
      getLogoutUrl: ({ sessionId, redirectUri }) =>
        `https://example.com/logout/${sessionId || 'session'}?redirect=${encodeURIComponent(redirectUri || '')}`
    };
    this.portal = {
      generateLink: async ({ organization }) => ({ link: `https://example.com/portal/${organization || 'org'}` })
    };
    this.webhooks = {
      constructEvent: ({ payload, sigHeader, secret }) => {
        // Minimal fake event, tests can override FakeWorkOS.mockEvent if needed
        return FakeWorkOS.mockEvent || {
          id: 'event_test',
          event: 'user.created',
          data: payload || { object: 'test' }
        };
      }
    };
  }
}

FakeWorkOS.mockAuthResponse = {};
FakeWorkOS.mockEvent = null;

function installWorkOSStub() {
  require.cache[modulePath] = {
    id: modulePath,
    filename: modulePath,
    loaded: true,
    exports: { WorkOS: FakeWorkOS }
  };
  return FakeWorkOS;
}

module.exports = { installWorkOSStub, FakeWorkOS };
