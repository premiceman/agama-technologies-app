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
      licenseTier: 'personal',
      licensePlan: 'free-personal',
      platformAccess: ['valuesphere'],
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

  if (!Array.isArray(user.platformAccess) || user.platformAccess.length === 0) {
    user.platformAccess = ['valuesphere'];
  }

  if (!user.licenseTier) {
    user.licenseTier = 'personal';
  }

  if (!user.licensePlan) {
    user.licensePlan = user.licenseTier === 'business' ? 'consulting-enterprise' : 'free-personal';
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
  if (!workosOrg) return null;

  const domains = extractOrgDomains(workosOrg);
  let organization = await Organization.findOne({ workosOrganizationId: workosOrg.id });

  if (!organization) {
    const slug = await generateUniqueOrgSlug(workosOrg.name || 'WorkOS Organization');
    organization = new Organization({
      name: workosOrg.name || 'WorkOS Organization',
      slug,
      workosOrganizationId: workosOrg.id,
      orgType: 'both',
      tier: 'business',
      platformAccess: ['valuesphere'],
      productAccess: ['valuesphere'],
      domains,
      seatLimit: 10
    });
  } else {
    organization.name = workosOrg.name || organization.name;
    organization.domains = domains;
  }

  await organization.save();
  return organization;
}

function mapMembershipRole(role) {
  const slug = typeof role === 'string' ? role : role?.slug;
  if (['owner', 'admin', 'member', 'viewer'].includes(slug)) {
    return slug;
  }
  return 'member';
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

  membership.role = mapMembershipRole(workosMembership.role);
  membership.status = mapMembershipStatus(workosMembership.status);
  membership.roleOrigin = 'idp';

  await membership.save();
  return membership;
}

module.exports = {
  syncWorkOSUser,
  syncWorkOSOrganization,
  syncWorkOSOrganizationMembership
};
