const mongoose = require('mongoose');
const { PUBLIC_ORGANIZATION_PLACEHOLDER_ID } = require('../utils/organizationPlaceholders');

const { Schema } = mongoose;

const ObjectiveSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    ownerUserId: { type: Schema.Types.ObjectId, ref: 'User' },
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

const TouchpointSchema = new Schema(
  {
    occurredOn: { type: Date, default: Date.now },
    type: { type: String, trim: true },
    summary: { type: String, trim: true },
    followUp: { type: String, trim: true },
    sentiment: { type: String, trim: true },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { _id: true, timestamps: true }
);

const ProcurementVendorSchema = new Schema(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      index: true,
      required: true,
      default: PUBLIC_ORGANIZATION_PLACEHOLDER_ID
    },
    createdByUserId: { type: Schema.Types.ObjectId, ref: 'User', index: true, required: true },
    name: { type: String, required: true, trim: true },
    domain: { type: String, trim: true },
    domainCategory: { type: String, trim: true },
    stage: {
      type: String,
      enum: [
        'intake',
        'discovery',
        'rfx_draft',
        'responding',
        'evaluation',
        'shortlist',
        'decision',
        'contract_signed',
        'active',
        'sunset'
      ],
      default: 'intake'
    },
    tier: { type: String, enum: ['strategic', 'preferred', 'tactical', 'specialist'], default: 'strategic' },
    businessOwner: { type: Schema.Types.ObjectId, ref: 'User' },
    relationshipManager: { type: Schema.Types.ObjectId, ref: 'User' },
    annualSpend: { type: Number, default: 0 },
    renewalDate: { type: Date },
    healthScore: { type: Number, min: 0, max: 100, default: 75 },
    riskLevel: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    riskSummary: { type: String, trim: true },
    scorecard: {
      overallScore: { type: Number, min: 0, max: 100 },
      weightingNotes: { type: String, trim: true }
    },
    objectives: { type: [ObjectiveSchema], default: [] },
    touchpoints: { type: [TouchpointSchema], default: [] },
    linkedRooms: [{ type: Schema.Types.ObjectId, ref: 'EngagementRoom' }],
    linkedAssessments: [{ type: Schema.Types.ObjectId, ref: 'BuyerValueAssessment' }],
    linkedRfx: [{ type: Schema.Types.ObjectId, ref: 'Rfx' }],
    tags: { type: [String], default: [] },
    notes: { type: String, trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('ProcurementVendor', ProcurementVendorSchema);
