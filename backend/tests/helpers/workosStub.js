const modulePath = require.resolve('@workos-inc/node');

class FakeWorkOS {
  constructor() {
    this.userManagement = {
      authenticateWithCode: async () => FakeWorkOS.mockAuthResponse,
      getAuthorizationUrl: () => 'https://example.com/auth',
      getLogoutUrl: ({ sessionId, redirectUri }) =>
        `https://example.com/logout/${sessionId || 'session'}?redirect=${encodeURIComponent(redirectUri || '')}`,
      createOrganizationMembership: async params => {
        FakeWorkOS.lastOrganizationMembershipCreateInput = params;
        return { id: `orgmem_${++FakeWorkOS.membershipCounter}` };
      }
    };
    this.portal = {
      generateLink: async ({ organization }) => ({ link: `https://example.com/portal/${organization || 'org'}` })
    };
    this.organizations = {
      createOrganization: async params => {
        FakeWorkOS.lastOrganizationCreateInput = params;
        const id = FakeWorkOS.nextOrganizationId || `org_test_${++FakeWorkOS.organizationCounter}`;
        FakeWorkOS.nextOrganizationId = null;
        return { id };
      }
    };
    this.webhooks = {
      constructEvent: ({ payload, sigHeader, secret }) => {
        const data = typeof payload === 'string' ? JSON.parse(payload || '{}') : payload;
        // Minimal fake event; tests can override FakeWorkOS.mockEvent if needed
        return FakeWorkOS.mockEvent || {
          id: 'event_test',
          event: 'user.created',
          data
        };
      }
    };
  }
}

FakeWorkOS.mockAuthResponse = {};
FakeWorkOS.mockEvent = null;
FakeWorkOS.lastOrganizationCreateInput = null;
FakeWorkOS.lastOrganizationMembershipCreateInput = null;
FakeWorkOS.nextOrganizationId = null;
FakeWorkOS.organizationCounter = 0;
FakeWorkOS.membershipCounter = 0;

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
