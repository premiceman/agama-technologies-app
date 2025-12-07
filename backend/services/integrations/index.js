const IntegrationState = require('../../models/IntegrationState');
const crm = require('./crm');
const gong = require('./gong');
const clari = require('./clari');
const email = require('./email');

const HANDLERS = {
  crm,
  gong,
  clari,
  email,
  calendar: email
};

async function upsertIntegrationState(connection) {
  const existing = await IntegrationState.findOne({ integrationConnection: connection._id });
  if (existing) return existing;
  return IntegrationState.create({
    orgId: connection.orgId,
    integrationConnection: connection._id,
    lastSyncStatus: null,
    errorCount: 0,
    metadata: {}
  });
}

async function simulateIntegrationSync(connection) {
  const handler = HANDLERS[connection.type] || {
    simulateSync: async () => ({ status: 'ok', summary: 'Simulated sync' })
  };

  const state = await upsertIntegrationState(connection);
  const result = await handler.simulateSync(connection);
  const now = new Date();
  const status = result.status || 'ok';

  state.lastSyncAt = now;
  state.nextSyncAt = new Date(now.getTime() + 6 * 60 * 60 * 1000);
  state.lastSyncStatus = status;
  state.lastSyncSummary = result.summary || 'Sync simulated';
  state.errorCount = status === 'ok' ? 0 : (state.errorCount || 0) + 1;
  state.metadata = {
    ...(state.metadata || {}),
    lastRunDurationMs: result.durationMs || 0
  };

  await state.save();
  return state;
}

module.exports = {
  simulateIntegrationSync,
  upsertIntegrationState
};
