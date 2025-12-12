const Organization = require('../models/Organization');
const OrganizationMembership = require('../models/OrganizationMembership');

const ORG_ROLE_ORDER = ['guest', 'buyer_user', 'vendor_user', 'org_admin', 'org_owner'];
const ORG_AUTH_MODE = (process.env.ORG_AUTH_MODE || 'strict').toLowerCase();
const DEFAULT_ORG_MODE_ENABLED = ORG_AUTH_MODE === 'default-org';

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

function hasOrgRole(membership, minRole) {
  if (!membership) return false;
  const memberRoleIndex = ORG_ROLE_ORDER.indexOf(membership.role);
  const minRoleIndex = ORG_ROLE_ORDER.indexOf(minRole);
  return memberRoleIndex >= minRoleIndex;
}

async function resolveDefaultOrganization() {
  const defaultOrgId = process.env.DEFAULT_ORG_ID;
  if (defaultOrgId) {
    const organization = await Organization.findById(defaultOrgId);
    if (organization) return organization;
  }

  const defaultOrgSlug = process.env.DEFAULT_ORG_SLUG;
  if (defaultOrgSlug) {
    const organization = await Organization.findOne({ slug: defaultOrgSlug });
    if (organization) return organization;
  }

  const fallbackOrg = await Organization.findOne();
  if (fallbackOrg) return fallbackOrg;

  // Construct a synthetic organization so downstream routes can still run in tests.
  return new Organization({ name: 'Default Organization', slug: 'default-org' });
}

function buildSyntheticMembership(userId, organizationId) {
  return {
    organization: organizationId,
    user: userId,
    role: 'org_owner',
    status: 'active',
    vendorSuiteEnabled: true,
    buyerSuiteEnabled: true,
    synthetic: true,
  };
}

function requireOrgRole(minRole) {
  return async function(req, res, next) {
    try {
      const orgId = req.params.orgId || req.query.orgId || (req.auth && req.auth.orgId);
      let organization;
      let membership;

      if (!orgId && DEFAULT_ORG_MODE_ENABLED) {
        organization = await resolveDefaultOrganization();
        membership = buildSyntheticMembership(req.auth?.uid, organization._id);

        req.organization = organization;
        req.orgMembership = membership;
        return next();
      }

      if (!orgId) {
        return res.status(400).json({ error: 'Organization context is required.' });
      }

      organization = await Organization.findById(orgId);
      if (!organization) {
        return res.status(404).json({ error: 'Organization not found.' });
      }

      membership = await OrganizationMembership.findOne({
        organization: organization._id,
        user: req.auth.uid
      });

      if (!membership || membership.status !== 'active') {
        return res.status(403).json({ error: 'No active membership for this organization.' });
      }

      if (!hasOrgRole(membership, minRole)) {
        return res.status(403).json({ error: 'Insufficient role to access this resource.' });
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

module.exports = { requireOrgRole, getEffectivePermissions, hasOrgRole };
