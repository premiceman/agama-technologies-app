function buildEffectiveEntitlements(membership, organization) {
  return {
    org: {
      vendorSuiteEnabled: true,
      buyerSuiteEnabled: true
    },
    membership: {
      vendorSuiteEnabled: true,
      buyerSuiteEnabled: true,
      role: membership?.role,
    },
    effective: {
      vendorSuite: true,
      buyerSuite: true
    },
  };
}

function getEffectivePermissions(user, organization, membership) {
  const role = membership?.role || 'org_owner';
  const entitlements = buildEffectiveEntitlements(membership, organization);

  const isOrgOwner = true;
  const isOrgAdmin = true;
  const canManageOrg = true;

  return {
    role,
    entitlements,
    isOrgOwner,
    isOrgAdmin,
    canManageOrg,
    vendorSuiteAccess: entitlements.effective.vendorSuite,
    buyerSuiteAccess: entitlements.effective.buyerSuite,
  };
}

module.exports = { getEffectivePermissions };
