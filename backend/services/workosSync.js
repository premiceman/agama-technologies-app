const User = require('../models/User');
const Organization = require('../models/Organization');
const OrganizationMembership = require('../models/OrganizationMembership');

async function generateUniqueOrgSlug(baseValue) {
  const baseSlug = String(baseValue || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 60);

  let slug = baseSlug || `org-${Date.now()}`;
  let suffix = 1;
  while (await Organization.findOne({ slug })) {
    slug = `${baseSlug || `org-${Date.now()}`}-${suffix++}`;
  }
  return slug;
}

function extractWorkOSUserName(workosUser) {
  const firstName = workosUser.first_name || workosUser.firstName;
  const lastName = workosUser.last_name || workosUser.lastName;
  const nameParts = [firstName, lastName].filter(Boolean);
  if (nameParts.length > 0) {
    return nameParts.join(' ');
  }
  return workosUser.name || workosUser.email || '';
}

function workosUserIsDeactivated(workosUser) {
  const state = String(workosUser.state || workosUser.status || '').toLowerCase();
  return ['inactive', 'deactivated', 'disabled'].includes(state);
}

async function syncWorkOSUser(workosUser) {
  if (!workosUser) return null;

  const email = (workosUser.email || '').toLowerCase();
  const fullName = extractWorkOSUserName(workosUser);

  let user = null;
  if (workosUser.id) {
    user = await User.findOne({ workosUserId: workosUser.id });
  }

  if (!user && email) {
    user = await User.findOne({ email });
  }

  const wasActive = user?.status === 'active';
  const wasDeactivated = user?.status === 'deactivated';

  if (!user) {
    user = new User({
      workosUserId: workosUser.id,
      email,
      name: fullName || email,
      passwordHash: null,
      authSource: 'workos',
      valueAssessmentLimit: 3,
      status: 'active'
    });
  }

  if (email && user.email !== email) {
    user.email = email;
  }

  if (fullName && user.name !== fullName) {
    user.name = fullName;
  }

  if (!user.workosUserId && workosUser.id) {
    user.workosUserId = workosUser.id;
  }

  const isDeactivated = workosUserIsDeactivated(workosUser);
  if (isDeactivated) {
    if (wasActive) {
      user.forceLogoutAt = new Date();
    }
    user.status = 'deactivated';
  } else {
    user.status = 'active';
    if (user.forceLogoutAt && wasDeactivated) {
      user.forceLogoutAt = null;
    }
  }

  await user.save();
  return user;
}

function extractOrgDomains(workosOrg) {
  if (!Array.isArray(workosOrg.domains)) return [];
  return workosOrg.domains
    .map(domain => (typeof domain === 'string' ? domain : domain?.domain))
    .filter(Boolean);
}

async function syncWorkOSOrganization(workosOrg) {
  if (!workosOrg) {
    console.warn('[workosSync] syncWorkOSOrganization called with empty workosOrg payload');
    return null;
  }

  const workosOrgId = workosOrg.id || workosOrg.organization || workosOrg.organizationId;
  const rawName = workosOrg.name;
  const effectiveName = rawName && String(rawName).trim().length > 0 ? String(rawName).trim() : null;

  try {
    const domains = extractOrgDomains(workosOrg);
    let organization = await Organization.findOne({ workosOrganizationId: workosOrgId });

    if (!organization) {
      const baseName = effectiveName || 'Unnamed WorkOS Organization';
      const slug = await generateUniqueOrgSlug(baseName);

      console.log('[workosSync] Creating local Organization from WorkOS organization', {
        workosOrgId,
        name: baseName,
        domains
      });

      organization = new Organization({
        name: baseName,
        slug,
        workosOrganizationId: workosOrgId,
        orgType: 'both',
        domains,
        vendorSuiteEnabled: true,
        buyerSuiteEnabled: true,
        productAccess: ['valuesphere'],
        seatLimits: { vendorSuite: 0, buyerSuite: 0, bothSuites: 0 }
      });
    } else {
      const before = {
        name: organization.name,
        domains: organization.domains
      };

      if (effectiveName) {
        organization.name = effectiveName;
      }

      organization.domains = domains;

      console.log('[workosSync] Updating local Organization from WorkOS organization', {
        workosOrgId,
        mongoOrgId: organization._id.toString(),
        before,
        after: {
          name: organization.name,
          domains: organization.domains
        }
      });
    }

    await organization.save();

    return organization;
  } catch (err) {
    console.error('[workosSync] Failed to sync WorkOS organization', {
      workosOrgId,
      name: effectiveName,
      error: err && err.message ? err.message : err
    });
    throw err;
  }
}

function mapWorkOSRoleSlugToOrgRole(slug) {
  if (!slug) return 'vendor_user';
  const normalised = String(slug).toLowerCase();
  if (normalised === 'owner') return 'org_owner';
  if (normalised === 'admin') return 'org_admin';
  if (normalised === 'viewer') return 'guest';
  if (normalised === 'buyer') return 'buyer_user';
  return 'vendor_user';
}

function mapMembershipStatus(status) {
  const normalised = String(status || '').toLowerCase();
  if (normalised === 'inactive') return 'suspended';
  if (normalised === 'pending') return 'invited';
  if (normalised === 'active') return 'active';
  if (normalised === 'removed') return 'removed';
  return 'active';
}

async function syncWorkOSOrganizationMembership(workosMembership) {
  if (!workosMembership) return null;

  const workosUser =
    workosMembership.user ||
    workosMembership.user_profile ||
    {
      id: workosMembership.user_id,
      email: workosMembership.user_email,
      first_name: workosMembership.user_first_name,
      last_name: workosMembership.user_last_name,
      state: workosMembership.status
    };

  const workosOrg =
    workosMembership.organization ||
    workosMembership.org ||
    {
      id: workosMembership.organization_id,
      name: workosMembership.organization_name,
      domains: workosMembership.organization_domains
    };

  const [user, organization] = await Promise.all([
    syncWorkOSUser(workosUser),
    syncWorkOSOrganization(workosOrg)
  ]);

  if (!user || !organization) return null;

  let membership = await OrganizationMembership.findOne({
    organization: organization._id,
    user: user._id
  });

  if (!membership) {
    membership = new OrganizationMembership({
      organization: organization._id,
      user: user._id
    });
  }

  membership.role = mapWorkOSRoleSlugToOrgRole(workosMembership.role?.slug || workosMembership.role);
  membership.status = mapMembershipStatus(workosMembership.status);
  membership.roleOrigin = 'idp';
  if (membership.vendorSuiteEnabled === undefined) {
    membership.vendorSuiteEnabled = Boolean(organization.vendorSuiteEnabled);
  }
  if (membership.buyerSuiteEnabled === undefined) {
    membership.buyerSuiteEnabled = Boolean(organization.buyerSuiteEnabled);
  }

  await membership.save();
  return membership;
}

module.exports = {
  syncWorkOSUser,
  syncWorkOSOrganization,
  syncWorkOSOrganizationMembership
};
