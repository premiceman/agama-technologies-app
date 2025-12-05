/* eslint-disable no-console */
require('dotenv').config();
const mongoose = require('mongoose');
const Organization = require('../models/Organization');
const OrganizationMembership = require('../models/OrganizationMembership');

async function main() {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error('[migration:rooms->seller] Missing MONGODB_URI');
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);
  console.log('[migration:rooms->seller] Connected');

  const orgs = await Organization.find({});
  for (const org of orgs) {
    // Mirror engagementRoomsEnabled to sellerSuiteEnabled if not already aligned
    if (org.sellerSuiteEnabled && !org.engagementRoomsEnabled) {
      org.engagementRoomsEnabled = true;
    }
    if (!org.sellerSuiteEnabled && org.engagementRoomsEnabled) {
      // Keep Rooms aligned to Seller; disable Rooms if Seller off.
      org.engagementRoomsEnabled = false;
    }
    await org.save();
  }

  const memberships = await OrganizationMembership.find({});
  for (const m of memberships) {
    if (m.sellerSuiteProvisioned && !m.engagementRoomsProvisioned) {
      m.engagementRoomsProvisioned = true;
      await m.save();
    }
    if (!m.sellerSuiteProvisioned && m.engagementRoomsProvisioned) {
      m.engagementRoomsProvisioned = false;
      await m.save();
    }
  }

  console.log('[migration:rooms->seller] Done');
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('[migration:rooms->seller] Unhandled error', err);
  process.exit(1);
});
