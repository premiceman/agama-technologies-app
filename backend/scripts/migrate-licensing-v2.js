/* eslint-disable no-console */
require('dotenv').config();
const mongoose = require('mongoose');
const Organization = require('../models/Organization');
const OrganizationMembership = require('../models/OrganizationMembership');

async function main() {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error('[migration:licensing-v2] Missing MONGODB_URI');
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);
  console.log('[migration:licensing-v2] Connected to MongoDB');

  const orgs = await Organization.find({});
  console.log('[migration:licensing-v2] Found organisations:', orgs.length);

  for (const org of orgs) {
    const legacyProductAccess = Array.isArray(org.productAccess)
      ? org.productAccess
      : Array.isArray(org.platformAccess)
        ? org.platformAccess
        : [];
    const accessSet = new Set(legacyProductAccess);

    let sellerSuiteEnabled = org.sellerSuiteEnabled;
    let buyerSuiteEnabled = org.buyerSuiteEnabled;
    let engagementRoomsEnabled = org.engagementRoomsEnabled;

    // Only set if not already configured.
    if (sellerSuiteEnabled === undefined || sellerSuiteEnabled === null) {
      sellerSuiteEnabled =
        accessSet.has('valuesphere') || accessSet.has('revenueforge') || accessSet.has('seller');
    }
    if (buyerSuiteEnabled === undefined || buyerSuiteEnabled === null) {
      buyerSuiteEnabled = accessSet.has('procurepath') || accessSet.has('buyer');
    }
    if (engagementRoomsEnabled === undefined || engagementRoomsEnabled === null) {
      // As a safe default, enable Rooms for business-tier orgs
      engagementRoomsEnabled = org.tier === 'business';
    }

    org.sellerSuiteEnabled = Boolean(sellerSuiteEnabled);
    org.buyerSuiteEnabled = Boolean(buyerSuiteEnabled);
    org.engagementRoomsEnabled = Boolean(engagementRoomsEnabled);

    // Initialise seatLimits per suite from legacy seatLimit if not set.
    const legacySeat = org.seatLimit || 0;
    if (!org.seatLimits || typeof org.seatLimits !== 'object') {
      org.seatLimits = {
        sellerSuite: legacySeat,
        buyerSuite: legacySeat,
        engagementRooms: legacySeat
      };
    } else {
      if (org.seatLimits.sellerSuite == null) org.seatLimits.sellerSuite = legacySeat;
      if (org.seatLimits.buyerSuite == null) org.seatLimits.buyerSuite = legacySeat;
      if (org.seatLimits.engagementRooms == null) org.seatLimits.engagementRooms = legacySeat;
    }

    await org.save();

    // Provision all active members for any suites the org has enabled.
    const memberships = await OrganizationMembership.find({
      organization: org._id,
      status: { $ne: 'removed' }
    });

    for (const membership of memberships) {
      if (org.sellerSuiteEnabled) membership.sellerSuiteProvisioned = true;
      if (org.buyerSuiteEnabled) membership.buyerSuiteProvisioned = true;
      if (org.engagementRoomsEnabled) membership.engagementRoomsProvisioned = true;
      await membership.save();
    }

    console.log('[migration:licensing-v2] Updated org', {
      id: org._id.toString(),
      name: org.name,
      sellerSuiteEnabled: org.sellerSuiteEnabled,
      buyerSuiteEnabled: org.buyerSuiteEnabled,
      engagementRoomsEnabled: org.engagementRoomsEnabled
    });
  }

  await mongoose.disconnect();
  console.log('[migration:licensing-v2] Done');
}

main().catch(err => {
  console.error('[migration:licensing-v2] Unhandled error', err);
  process.exit(1);
});
