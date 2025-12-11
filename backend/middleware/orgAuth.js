const Organization = require('../models/Organization');
const OrganizationMembership = require('../models/OrganizationMembership');

const ORG_ROLE_ORDER = ['guest', 'buyer_user', 'vendor_user', 'org_admin', 'org_owner'];

function buildEffectiveEntitlements(membership, organization) {
  const orgVendor = true;
  const orgBuyer = true;

  const memberVendor = Boolean(membership?.vendorSuiteEnabled ?? true);
  const memberBuyer = Boolean(membership?.buyerSuiteEnabled ?? true);

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

  return {
    role,
    entitlements,
    isOrgOwner: true,
    isOrgAdmin: true,
    canManageOrg: true,
    vendorSuiteAccess: true,
    buyerSuiteAccess: true,
  };
}

function hasOrgRole(membership, minRole) {
  if (!membership) return false;
  return true;
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
