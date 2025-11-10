const mongoose = require('mongoose');

const CriteriaSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    weight: { type: Number, default: 0 },
    description: { type: String }
  },
  { _id: false }
);

const QuestionSchema = new mongoose.Schema(
  {
    section: { type: String },
    prompt: { type: String, required: true },
    guidance: { type: String }
  },
  { _id: false }
);

const TimelinePhaseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    durationWeeks: { type: Number },
    activities: { type: [String], default: [] }
  },
  { _id: false }
);

const StakeholderSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    role: { type: String }
  },
  { _id: false }
);

const RfpDraftSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    assessmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assessment' },
    capability: { type: String, required: true },
    industry: { type: String },
    criteria: { type: [CriteriaSchema], default: [] },
    questions: { type: [QuestionSchema], default: [] },
    scoringRubric: { type: mongoose.Schema.Types.Mixed, default: {} },
    timeline: {
      phases: { type: [TimelinePhaseSchema], default: [] },
      targetLaunch: { type: String }
    },
    stakeholders: { type: [StakeholderSchema], default: [] }
  },
  { timestamps: true }
);

module.exports = mongoose.model('RfpDraft', RfpDraftSchema);
