const mongoose = require('mongoose');
const { Schema } = mongoose;

const MeetingSchema = new Schema(
  {
    title: { type: String, trim: true },
    occurredAt: { type: Date, required: true },
    notes: { type: String, trim: true },
    followUps: { type: String, trim: true },
    internalAttendees: { type: [String], default: [] },
    customerAttendees: { type: [String], default: [] },
    sentiment: { type: String, trim: true },
    aiSummary: { type: String, trim: true },
    aiActions: { type: String, trim: true },
    transcriptSource: { type: String, trim: true }
  },
  { _id: true, timestamps: true }
);

const OpportunitySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    value: { type: Number, default: 0 },
    stage: { type: String, trim: true },
    owner: { type: String, trim: true },
    probability: { type: Number, min: 0, max: 100 },
    closeDate: { type: Date },
    summary: { type: String, trim: true },
    qualification: {
      framework: { type: String, trim: true },
      score: { type: Number, min: 0, max: 100 },
      champion: { type: String, trim: true },
      blockers: { type: String, trim: true },
      notes: { type: String, trim: true }
    },
    timelines: [
      {
        milestone: { type: String, trim: true },
        targetDate: { type: Date },
        risk: { type: String, trim: true }
      }
    ],
    risks: [
      {
        title: { type: String, trim: true },
        severity: { type: String, trim: true },
        impact: { type: String, trim: true },
        mitigation: { type: String, trim: true },
        owner: { type: String, trim: true }
      }
    ],
    personas: [
      {
        name: { type: String, trim: true },
        role: { type: String, trim: true },
        influence: { type: String, trim: true },
        goals: { type: String, trim: true },
        stance: { type: String, trim: true },
        contact: { type: String, trim: true }
      }
    ],
    architecture: {
      currentState: { type: String, trim: true },
      proposedState: { type: String, trim: true },
      integrations: { type: String, trim: true }
    },
    technicalRequirements: [
      {
        requirement: { type: String, trim: true },
        priority: { type: String, trim: true },
        owner: { type: String, trim: true },
        status: { type: String, trim: true }
      }
    ],
    pocSuccess: [
      {
        criterion: { type: String, trim: true },
        metric: { type: String, trim: true },
        status: { type: String, trim: true },
        owner: { type: String, trim: true }
      }
    ],
    customLinks: [
      {
        label: { type: String, trim: true },
        url: { type: String, trim: true },
        description: { type: String, trim: true }
      }
    ],
    collateral: [
      {
        title: { type: String, trim: true },
        type: { type: String, trim: true },
        url: { type: String, trim: true }
      }
    ],
    meetingNotes: [MeetingSchema]
  },
  { _id: true, timestamps: true }
);

const RevenueAccountSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true, required: true },
    name: { type: String, required: true, trim: true },
    headcount: { type: Number, min: 1 },
    ownership: { type: String, trim: true },
    industry: { type: String, trim: true },
    region: { type: String, trim: true },
    website: { type: String, trim: true },
    description: { type: String, trim: true },
    revenueRange: { type: String, trim: true },
    isCustomer: { type: Boolean, default: false },
    opportunities: [OpportunitySchema]
  },
  { timestamps: true }
);

module.exports = mongoose.model('RevenueAccount', RevenueAccountSchema);
