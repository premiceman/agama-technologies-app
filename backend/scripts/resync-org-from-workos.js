/* eslint-disable no-console */
require('dotenv').config();

const mongoose = require('mongoose');
const { WorkOS } = require('@workos-inc/node');

const Organization = require('../models/Organization');
const { syncWorkOSOrganization } = require('../services/workosSync');

async function main() {
  const MONGODB_URI = process.env.MONGODB_URI;
  const WORKOS_API_KEY = process.env.WORKOS_API_KEY;

  if (!MONGODB_URI || !WORKOS_API_KEY) {
    console.error('[script:resync-org-from-workos] Missing MONGODB_URI or WORKOS_API_KEY');
    process.exit(1);
  }

  const workosOrgId = process.argv[2];
  if (!workosOrgId) {
    console.error(
      '[script:resync-org-from-workos] Usage: node scripts/resync-org-from-workos.js <workosOrgId>'
    );
    process.exit(1);
  }

  console.log('[script:resync-org-from-workos] Starting', { workosOrgId });

  await mongoose.connect(MONGODB_URI);
  console.log('[script:resync-org-from-workos] Connected to MongoDB');

  const workos = new WorkOS(WORKOS_API_KEY);

  try {
    const workosOrg = await workos.organizations.getOrganization(workosOrgId);
    console.log('[script:resync-org-from-workos] Fetched WorkOS org', {
      id: workosOrg.id,
      name: workosOrg.name,
      domains: workosOrg.domains
    });

    const updated = await syncWorkOSOrganization(workosOrg);
    console.log('[script:resync-org-from-workos] Updated local Organization', {
      id: updated._id.toString(),
      name: updated.name,
      slug: updated.slug,
      domains: updated.domains,
      workosOrganizationId: updated.workosOrganizationId
    });
  } catch (err) {
    console.error('[script:resync-org-from-workos] Error during resync', {
      workosOrgId,
      error: err && err.message ? err.message : err
    });
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('[script:resync-org-from-workos] Disconnected from MongoDB');
  }
}

main().catch(err => {
  console.error('[script:resync-org-from-workos] Unhandled error', err);
  process.exit(1);
});
