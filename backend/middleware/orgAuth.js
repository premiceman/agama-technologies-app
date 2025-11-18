const Organization = require('../models/Organization');
const OrganizationMembership = require('../models/OrganizationMembership');

const ORG_ROLE_ORDER = ['viewer', 'member', 'admin', 'owner'];

function hasOrgRole(membership, minRole) {
  if (!membership) return false;
  const current = ORG_ROLE_ORDER.indexOf(membership.role || 'member');
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

module.exports = { requireOrgRole };
