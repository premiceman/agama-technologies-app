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
  }
}

FakeWorkOS.mockAuthResponse = {};

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
