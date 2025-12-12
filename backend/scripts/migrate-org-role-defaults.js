#!/usr/bin/env node
/* eslint-disable no-console */
const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const EngagementRoomInvite = require('../models/EngagementRoomInvite');
const ValueSphereTemplate = require('../models/ValueSphereTemplate');
const { ensureSandboxOrganization, SANDBOX_ORG_OBJECT_ID } = require('../services/sandboxOrg');

const DRY_RUN = process.argv.includes('--dry-run');
const USE_MEMORY = process.argv.includes('--memory');
let mongoServer = null;

async function ensureConnection() {
  let uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/agama_tech';

  if (USE_MEMORY) {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    mongoServer = await MongoMemoryServer.create();
    uri = mongoServer.getUri();
    console.log('[migrate] Using in-memory MongoDB instance');
  }

  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
}

async function summarizeAndUpdate(model, query, update, label) {
  const count = await model.countDocuments(query);

  if (!count) {
    console.log(`[migrate] ${label}: nothing to update.`);
    return { matched: 0, modified: 0 };
  }

  if (DRY_RUN) {
    console.log(`[migrate] [dry-run] ${label}: would update ${count} documents.`);
    return { matched: count, modified: 0 };
  }

  const result = await model.updateMany(query, update);
  console.log(`[migrate] ${label}: matched ${result.matchedCount}, modified ${result.modifiedCount}.`);
  return { matched: result.matchedCount, modified: result.modifiedCount };
}

async function migrate() {
  await ensureConnection();
  const sandboxOrg = await ensureSandboxOrganization();
  const defaultOrgId = sandboxOrg?._id || SANDBOX_ORG_OBJECT_ID;

  const results = {};

  results.inviteOrg = await summarizeAndUpdate(
    EngagementRoomInvite,
    { $or: [{ organization: { $exists: false } }, { organization: null }] },
    { $set: { organization: defaultOrgId } },
    'room invites missing organization'
  );

  results.inviteRole = await summarizeAndUpdate(
    EngagementRoomInvite,
    { $or: [{ role: { $exists: false } }, { role: null }] },
    { $set: { role: 'viewer' } },
    'room invites missing role'
  );

  results.templateOrg = await summarizeAndUpdate(
    ValueSphereTemplate,
    { $or: [{ organization: { $exists: false } }, { organization: null }] },
    { $set: { organization: defaultOrgId } },
    'ValueSphere templates missing organization'
  );

  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }

  console.log('[migrate] Complete', {
    dryRun: DRY_RUN,
    inMemory: USE_MEMORY,
    results
  });
}

migrate()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('[migrate] Failed to run org/role defaults migration', err);
    process.exit(1);
  });
