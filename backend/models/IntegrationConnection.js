const mongoose = require('mongoose');

const { Schema } = mongoose;

const IntegrationConnectionSchema = new Schema(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    type: {
      type: String,
      enum: ['crm', 'gong', 'clari', 'email', 'calendar', 'procurement_erp', 'other'],
      required: true
    },
    provider: { type: String, required: true },
    config: { type: Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: ['not_configured', 'configured', 'error'],
      default: 'not_configured'
    },
    lastErrorMessage: { type: String, default: null }
  },
  { timestamps: true }
);

IntegrationConnectionSchema.index({ orgId: 1, type: 1, provider: 1 });

module.exports = mongoose.model('IntegrationConnection', IntegrationConnectionSchema);
