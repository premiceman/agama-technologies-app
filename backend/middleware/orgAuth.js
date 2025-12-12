function buildEffectiveEntitlements(membership, organization) {
  const orgVendor = Boolean(organization?.vendorSuiteEnabled ?? false);
  const orgBuyer = Boolean(organization?.buyerSuiteEnabled ?? false);

  const memberVendor = Boolean(membership?.vendorSuiteEnabled ?? false);
  const memberBuyer = Boolean(membership?.buyerSuiteEnabled ?? false);

  const effectiveVendorSuite = orgVendor && memberVendor;
  const effectiveBuyerSuite = orgBuyer && memberBuyer;

  return {
    org: {
      vendorSuiteEnabled: orgVendor,
      buyerSuiteEnabled: orgBuyer,
    },
    membership: {
      vendorSuiteEnabled: memberVendor,
      buyerSuiteEnabled: memberBuyer,
      role: membership?.role,
    },
    effective: {
      vendorSuite: effectiveVendorSuite,
      buyerSuite: effectiveBuyerSuite,
    },
  };
}

function getEffectivePermissions(user, organization, membership) {
  const role = membership?.role;
  const entitlements = buildEffectiveEntitlements(membership, organization);

  const isOrgOwner = role === 'org_owner';
  const isOrgAdmin = role === 'org_owner' || role === 'org_admin';
  const canManageOrg = isOrgAdmin;

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
