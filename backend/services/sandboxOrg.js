const mongoose = require('mongoose');
const Organization = require('../models/Organization');
const EngagementRoom = require('../models/EngagementRoom');
const EngagementRoomMembership = require('../models/EngagementRoomMembership');
const {
  DEFAULT_SANDBOX_ORG_ID,
  DEFAULT_SANDBOX_ORG_NAME,
  DEFAULT_SANDBOX_ORG_SLUG
} = require('../config/defaultOrg');

const SANDBOX_ORG_OBJECT_ID = new mongoose.Types.ObjectId(DEFAULT_SANDBOX_ORG_ID);

async function ensureSandboxOrganization() {
  let org = await Organization.findById(SANDBOX_ORG_OBJECT_ID);
  if (!org) {
    org = await Organization.findOne({ slug: DEFAULT_SANDBOX_ORG_SLUG });
  }

  if (!org) {
    org = await Organization.create({
      _id: SANDBOX_ORG_OBJECT_ID,
      name: DEFAULT_SANDBOX_ORG_NAME,
      slug: DEFAULT_SANDBOX_ORG_SLUG,
      orgType: 'both',
      tier: 'business',
      vendorSuiteEnabled: true,
      buyerSuiteEnabled: true
    });
    return org;
  }

  const updates = {};
  if (!org.slug) updates.slug = DEFAULT_SANDBOX_ORG_SLUG;
  if (!org.name) updates.name = DEFAULT_SANDBOX_ORG_NAME;
  if (org.orgType !== 'both') updates.orgType = 'both';
  if (org.tier !== 'business') updates.tier = 'business';
  if (org.vendorSuiteEnabled === false) updates.vendorSuiteEnabled = true;
  if (org.buyerSuiteEnabled === false) updates.buyerSuiteEnabled = true;

  if (Object.keys(updates).length) {
    org.set(updates);
    await org.save();
  }

  return org;
}

async function backfillSandboxOrgReferences() {
  const org = await ensureSandboxOrganization();

  const vendorResult = await EngagementRoom.updateMany(
    { $or: [{ vendorOrg: { $exists: false } }, { vendorOrg: null }] },
    { $set: { vendorOrg: org._id } }
  );

  const buyerResult = await EngagementRoom.updateMany(
    { $or: [{ buyerOrg: { $exists: false } }, { buyerOrg: null }] },
    { $set: { buyerOrg: org._id } }
  );

  const membershipResult = await EngagementRoomMembership.updateMany(
    { $or: [{ organization: { $exists: false } }, { organization: null }] },
    { $set: { organization: org._id } }
  );

  return {
    org,
    stats: {
      vendorRoomsUpdated: vendorResult.modifiedCount,
      buyerRoomsUpdated: buyerResult.modifiedCount,
      membershipsUpdated: membershipResult.modifiedCount
    }
  };
}

async function bootstrapSandboxOrg() {
  try {
    return await backfillSandboxOrgReferences();
  } catch (err) {
    console.error('Sandbox org bootstrap failed', err);
    return null;
  }
}

module.exports = {
  SANDBOX_ORG_OBJECT_ID,
  ensureSandboxOrganization,
  backfillSandboxOrgReferences,
  bootstrapSandboxOrg
};
