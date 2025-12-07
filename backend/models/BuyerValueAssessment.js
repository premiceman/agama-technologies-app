const mongoose = require('mongoose');

const { Schema } = mongoose;

const CriterionSchema = new Schema(
  {
    sectionId: { type: String, trim: true },
    questionId: { type: String, trim: true },
    label: { type: String, trim: true },
    type: { type: String, enum: ['text', 'numeric', 'select', 'multi', 'boolean'], default: 'text' },
    weight: { type: Number, default: 0 },
    responseText: { type: String, trim: true },
    responseNumeric: { type: Number },
    responseOptions: { type: [String], default: [] },
    score: { type: Number },
    normalizedScore: { type: Number },
    notes: { type: String, trim: true },
    visibility: { type: String, enum: ['buyer_only', 'shared'], default: 'buyer_only' }
  },
  { _id: false }
);

const SectionScoreSchema = new Schema(
  {
    sectionId: { type: String, trim: true },
    weight: { type: Number, default: 0 },
    score: { type: Number, default: 0 }
  },
  { _id: false }
);

const StakeholderSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    name: { type: String, trim: true },
    role: { type: String, trim: true },
    influence: { type: String, trim: true },
    vote: { type: String, trim: true },
    orgSide: { type: String, enum: ['buyer', 'vendor', 'shared'], default: 'buyer' },
    notes: { type: String, trim: true }
  },
  { _id: false }
);

const BuyerValueAssessmentSchema = new Schema(
  {
    organization: { type: Schema.Types.ObjectId, ref: 'Organization', default: null },
    procurementVendor: { type: Schema.Types.ObjectId, ref: 'ProcurementVendor', default: null },
    revenueAccount: { type: Schema.Types.ObjectId, ref: 'RevenueAccount', default: null },
    engagementRoom: { type: Schema.Types.ObjectId, ref: 'EngagementRoom', default: null },
    template: { type: Schema.Types.ObjectId, ref: 'ValueSphereTemplate', default: null },
    templateVersion: { type: Number, default: 1 },
    mode: { type: String, enum: ['buyer', 'seller', 'shared'], default: 'buyer' },
    state: { type: String, enum: ['draft', 'shared', 'agreed', 'locked'], default: 'draft' },
    vendorName: { type: String, required: true, trim: true },
    title: { type: String, trim: true },
    dimensions: { type: [Schema.Types.Mixed], default: [] },
    summary: { type: String, trim: true },
    tags: { type: [String], default: [] },
    criteria: { type: [CriterionSchema], default: [] },
    responses: {
      type: [
        new Schema(
          {
            sectionId: { type: String, trim: true },
            questionId: { type: String, trim: true },
            responderUserId: { type: Schema.Types.ObjectId, ref: 'User' },
            valueText: { type: String, trim: true },
            valueNumeric: { type: Number },
            valueSelect: { type: String, trim: true },
            valueMulti: { type: [String], default: [] },
            lastUpdatedAt: { type: Date }
          },
          { _id: false }
        )
      ],
      default: []
    },
    scoring: {
      methodology: { type: String, trim: true },
      weightingModel: {
        technicalFit: { type: Number, default: 0 },
        costImpact: { type: Number, default: 0 },
        risk: { type: Number, default: 0 },
        valueDrivers: { type: Number, default: 0 }
      },
      sectionScores: { type: [SectionScoreSchema], default: [] },
      totalScore: { type: Number, default: 0 },
      normalizedScore: { type: Number }
    },
    decision: {
      status: { type: String, enum: ['undecided', 'shortlist', 'selected', 'rejected'], default: 'undecided' },
      justification: { type: String, trim: true },
      decidedAt: { type: Date },
      decidedBy: { type: Schema.Types.ObjectId, ref: 'User' }
    },
    stakeholders: { type: [StakeholderSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('BuyerValueAssessment', BuyerValueAssessmentSchema);
