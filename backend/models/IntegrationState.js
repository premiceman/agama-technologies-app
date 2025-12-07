const mongoose = require('mongoose');

const { Schema } = mongoose;

const IntegrationStateSchema = new Schema(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    integrationConnection: { type: Schema.Types.ObjectId, ref: 'IntegrationConnection', required: true },
    lastSyncAt: { type: Date },
    nextSyncAt: { type: Date },
    lastSyncStatus: { type: String, enum: ['ok', 'error', 'partial'], default: null },
    lastSyncSummary: { type: String, default: null },
    errorCount: { type: Number, default: 0 },
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

IntegrationStateSchema.index({ orgId: 1, integrationConnection: 1 });

module.exports = mongoose.model('IntegrationState', IntegrationStateSchema);
