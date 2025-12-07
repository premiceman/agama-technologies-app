const Organization = require('../models/Organization');
const OrganizationMembership = require('../models/OrganizationMembership');

const ORG_ROLE_ORDER = ['guest', 'buyer_user', 'vendor_user', 'org_admin', 'org_owner'];

function buildEffectiveEntitlements(membership, organization) {
  const orgVendor = Boolean(organization?.vendorSuiteEnabled);
  const orgBuyer = Boolean(organization?.buyerSuiteEnabled);

  const memberVendor = Boolean(membership?.vendorSuiteEnabled);
  const memberBuyer = Boolean(membership?.buyerSuiteEnabled);

  const isGuest = (membership?.role || '').toLowerCase() === 'guest';

  const effectiveVendorSuite = !isGuest && orgVendor && memberVendor;
  const effectiveBuyerSuite = !isGuest && orgBuyer && memberBuyer;

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
  const isOrgAdmin = role === 'org_admin';
  const isStaff = Boolean(user?.isStaff);

  const vendorSuiteAccess =
    (entitlements.effective.vendorSuite && ['org_owner', 'org_admin', 'vendor_user'].includes(role)) ||
    isStaff;
  const buyerSuiteAccess =
    (entitlements.effective.buyerSuite && ['org_owner', 'org_admin', 'buyer_user'].includes(role)) ||
    isStaff;

  return {
    role,
    entitlements,
    isOrgOwner,
    isOrgAdmin,
    canManageOrg: isOrgOwner || isOrgAdmin,
    vendorSuiteAccess,
    buyerSuiteAccess,
  };
}

function hasOrgRole(membership, minRole) {
  if (!membership) return false;
  const current = ORG_ROLE_ORDER.indexOf(membership.role || 'guest');
  const required = ORG_ROLE_ORDER.indexOf(minRole);
  return current >= required;
}

function requireOrgRole(minRole) {
  return async function(req, res, next) {
    try {
      const orgId = req.params.orgId || req.query.orgId || (req.auth && req.auth.orgId);

      if (!orgId) {
        return res.status(400).json({ error: 'Organization context is required.' });
      }

      const organization = await Organization.findById(orgId);
      if (!organization) {
        return res.status(404).json({ error: 'Organization not found.' });
      }

      const membership = await OrganizationMembership.findOne({
        organization: organization._id,
        user: req.auth.uid
      });

      if (!membership || membership.status !== 'active') {
        return res.status(403).json({ error: 'No active membership for this organization.' });
      }

      if (!hasOrgRole(membership, minRole)) {
        return res.status(403).json({ error: 'Insufficient organization role.' });
      }

      req.organization = organization;
      req.orgMembership = membership;

      return next();
    } catch (err) {
      console.error('Org RBAC error', err);
      return res.status(500).json({ error: 'Organization authorization failed.' });
    }
  };
}

module.exports = { requireOrgRole, getEffectivePermissions };
