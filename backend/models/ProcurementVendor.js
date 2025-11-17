const mongoose = require('mongoose');

const ObjectiveSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    owner: { type: String, trim: true },
    targetMetric: { type: String, trim: true },
    targetValue: { type: Number },
    unit: { type: String, trim: true },
    dueDate: { type: Date },
    status: {
      type: String,
      enum: ['on-track', 'at-risk', 'blocked', 'completed'],
      default: 'on-track'
    },
    notes: { type: String, trim: true },
    aiSummary: { type: String, trim: true }
  },
  { _id: true, timestamps: true }
);

const TouchpointSchema = new mongoose.Schema(
  {
    occurredOn: { type: Date, default: Date.now },
    type: { type: String, trim: true },
    summary: { type: String, trim: true },
    followUp: { type: String, trim: true },
    sentiment: { type: String, trim: true }
  },
  { _id: true, timestamps: true }
);

const ProcurementVendorSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, trim: true },
    tier: { type: String, enum: ['strategic', 'preferred', 'tactical', 'specialist'], default: 'strategic' },
    businessOwner: { type: String, trim: true },
    relationshipManager: { type: String, trim: true },
    annualSpend: { type: Number, default: 0 },
    renewalDate: { type: Date },
    healthScore: { type: Number, min: 0, max: 100, default: 75 },
    riskLevel: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
    status: { type: String, enum: ['active', 'watchlist', 'sunset'], default: 'active' },
    objectives: { type: [ObjectiveSchema], default: [] },
    touchpoints: { type: [TouchpointSchema], default: [] },
    notes: { type: String, trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('ProcurementVendor', ProcurementVendorSchema);
