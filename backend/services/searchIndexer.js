const mongoose = require('mongoose');
const SearchIndexEntry = require('../models/SearchIndexEntry');
const EngagementRoom = require('../models/EngagementRoom');
const EngagementRoomMembership = require('../models/EngagementRoomMembership');
const ProcurementVendor = require('../models/ProcurementVendor');
const RevenueAccount = require('../models/RevenueAccount');
const BuyerValueAssessment = require('../models/BuyerValueAssessment');
const Rfx = require('../models/Rfx');
const RfxItem = require('../models/RfxItem');
const OrganizationMembership = require('../models/OrganizationMembership');

function toObjectId(value) {
  if (!value) return null;
  return mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : null;
}

async function upsertEntry({
  orgId,
  entityType,
  entityId,
  roomId = null,
  suite,
  visibility = 'shared',
  title,
  snippet = '',
  payload = {},
  ownerIds = [],
  participantIds = [],
  tags = []
}) {
  if (!orgId || !entityType || !entityId || !suite || !title) return null;

  const normalized = {
    orgId: toObjectId(orgId),
    entityType,
    entityId: toObjectId(entityId),
    roomId: toObjectId(roomId),
    suite,
    visibility,
    title,
    snippet,
    payload,
    ownerIds: ownerIds.map(toObjectId).filter(Boolean),
    participantIds: participantIds.map(toObjectId).filter(Boolean),
    tags,
    updatedAt: new Date()
  };

  return SearchIndexEntry.findOneAndUpdate(
    { orgId: normalized.orgId, entityType, entityId: normalized.entityId, visibility },
    { $set: normalized },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function removeEntriesForEntity(entityType, entityId) {
  if (!entityType || !entityId) return 0;
  return SearchIndexEntry.deleteMany({ entityType, entityId: toObjectId(entityId) });
}

async function indexEngagementRoom(roomId) {
  const room = await EngagementRoom.findById(roomId).lean();
  if (!room) return null;

  const memberships = await EngagementRoomMembership.find({ room: room._id }).lean();
  const participantIds = memberships.map(m => m.user);

  const entries = [];
  if (room.vendorOrg) {
    entries.push(
      upsertEntry({
        orgId: room.vendorOrg,
        entityType: 'engagement_room',
        entityId: room._id,
        roomId: room._id,
        suite: 'vendor',
        visibility: 'vendor_only',
        title: room.title,
        snippet: 'Engagement Room (vendor)',
        payload: {
          buyerOrg: room.buyerOrg,
          vendorOrg: room.vendorOrg
        },
        participantIds
      })
    );
  }

  if (room.buyerOrg) {
    entries.push(
      upsertEntry({
        orgId: room.buyerOrg,
        entityType: 'engagement_room',
        entityId: room._id,
        roomId: room._id,
        suite: 'buyer',
        visibility: 'buyer_only',
        title: room.title,
        snippet: 'Engagement Room (buyer)',
        payload: {
          buyerOrg: room.buyerOrg,
          vendorOrg: room.vendorOrg
        },
        participantIds
      })
    );
  }

  if (room.vendorOrg && room.buyerOrg) {
    entries.push(
      upsertEntry({
        orgId: room.vendorOrg,
        entityType: 'engagement_room',
        entityId: room._id,
        roomId: room._id,
        suite: 'shared',
        visibility: 'shared',
        title: room.title,
        snippet: 'Shared room context',
        payload: {
          buyerOrg: room.buyerOrg,
          vendorOrg: room.vendorOrg
        },
        participantIds
      })
    );
    entries.push(
      upsertEntry({
        orgId: room.buyerOrg,
        entityType: 'engagement_room',
        entityId: room._id,
        roomId: room._id,
        suite: 'shared',
        visibility: 'shared',
        title: room.title,
        snippet: 'Shared room context',
        payload: {
          buyerOrg: room.buyerOrg,
          vendorOrg: room.vendorOrg
        },
        participantIds
      })
    );
  }

  return Promise.all(entries);
}

async function indexProcurementVendor(vendorId) {
  const vendor = await ProcurementVendor.findById(vendorId).lean();
  if (!vendor) return null;

  return upsertEntry({
    orgId: vendor.orgId,
    entityType: 'procurement_vendor',
    entityId: vendor._id,
    suite: 'buyer',
    visibility: 'buyer_only',
    title: vendor.name,
    snippet: vendor.riskSummary || vendor.notes || vendor.domain || 'Procurement vendor',
    payload: {
      stage: vendor.stage,
      riskLevel: vendor.riskLevel,
      tags: vendor.tags || []
    },
    ownerIds: [vendor.businessOwner, vendor.relationshipManager].filter(Boolean),
    tags: vendor.tags || []
  });
}

async function indexRevenueAccount(accountId, orgId) {
  const account = await RevenueAccount.findById(accountId).lean();
  if (!account) return null;

  const primarySnippet =
    account.description ||
    (account.opportunities && account.opportunities[0] && account.opportunities[0].summary) ||
    account.website ||
    'Revenue account';

  return upsertEntry({
    orgId: orgId || null,
    entityType: 'revenue_account',
    entityId: account._id,
    suite: 'vendor',
    visibility: 'vendor_only',
    title: account.name,
    snippet: primarySnippet,
    payload: {
      industry: account.industry,
      region: account.region,
      owner: account.ownership
    },
    ownerIds: [account.userId]
  });
}

function resolveAssessmentVisibility(assessment) {
  if (assessment.mode === 'buyer') return 'buyer_only';
  if (assessment.mode === 'seller') return 'vendor_only';
  return 'shared';
}

function resolveAssessmentSuite(assessment) {
  if (assessment.mode === 'buyer') return 'buyer';
  if (assessment.mode === 'seller') return 'vendor';
  return 'shared';
}

async function indexBuyerAssessment(assessmentId) {
  const assessment = await BuyerValueAssessment.findById(assessmentId).lean();
  if (!assessment) return null;

  const visibility = resolveAssessmentVisibility(assessment);
  const suite = resolveAssessmentSuite(assessment);

  return upsertEntry({
    orgId: assessment.organization,
    entityType: 'valuesphere_assessment',
    entityId: assessment._id,
    suite,
    visibility,
    title: assessment.title || assessment.vendorName || 'Value assessment',
    snippet: assessment.summary || 'ValueSphere assessment',
    payload: {
      vendorName: assessment.vendorName,
      mode: assessment.mode,
      state: assessment.state
    },
    ownerIds: [assessment.createdBy],
    participantIds: []
  });
}

async function indexRfxItems(rfxId) {
  const rfx = await Rfx.findById(rfxId).lean();
  if (!rfx) return null;

  const items = await RfxItem.find({ rfxId: rfx._id }).lean();
  await Promise.all(items.map(item => removeEntriesForEntity('rfx_item', item._id)));

  return Promise.all(
    items.map(item =>
      upsertEntry({
        orgId: rfx.orgId,
        entityType: 'rfx_item',
        entityId: item._id,
        suite: 'buyer',
        visibility: 'buyer_only',
        title: item.prompt,
        snippet: item.evaluationRubric || 'RFX item',
        payload: {
          tags: item.tags || [],
          rfxStatus: rfx.status,
          topicArea: rfx.topicArea
        },
        tags: item.tags || []
      })
    )
  );
}

async function reindexOrg() {
  const rooms = await EngagementRoom.find().lean();
  await Promise.all(rooms.map(room => indexEngagementRoom(room._id)));

  const vendors = await ProcurementVendor.find().lean();
  await Promise.all(vendors.map(vendor => indexProcurementVendor(vendor._id)));

  const assessments = await BuyerValueAssessment.find().lean();
  await Promise.all(assessments.map(assessment => indexBuyerAssessment(assessment._id)));

  const members = await OrganizationMembership.find({ status: 'active' }).lean();
  const memberUserIds = members.map(m => m.user).filter(Boolean);
  if (memberUserIds.length > 0) {
    const accounts = await RevenueAccount.find({ userId: { $in: memberUserIds } }).lean();
    await Promise.all(accounts.map(account => indexRevenueAccount(account._id, null)));
  }

  const rfxList = await Rfx.find().lean();
  await Promise.all(rfxList.map(rfx => indexRfxItems(rfx._id)));

  return true;
}

module.exports = {
  upsertEntry,
  removeEntriesForEntity,
  indexEngagementRoom,
  indexProcurementVendor,
  indexRevenueAccount,
  indexBuyerAssessment,
  indexRfxItems,
  reindexOrg
};
