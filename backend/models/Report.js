const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ReportSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', index: true, required: true },
  assessmentId: { type: Schema.Types.ObjectId, ref: 'Assessment', required: true },
  stage: {
    type: String,
    enum: ['insight', 'strategic', 'command', 'free', 'premium'],
    default: 'insight'
  },
  vertical: { type: String, default: 'generic' },
  assessmentType: { type: String, default: 'security' },
  headlineScore: { type: Number, required: true },
  pillarScores: { type: Schema.Types.Mixed, required: true },
  benchmarks: { type: Schema.Types.Mixed, required: true },
  recommendations: { type: [String], default: [] },
  summary: { type: String, default: '' },
  strategicNarrative: { type: String, default: '' },
  competitorSummary: { type: Schema.Types.Mixed, default: {} },
  pillarInsights: { type: Schema.Types.Mixed, default: {} },
  roadmap: { type: Schema.Types.Mixed, default: {} },
  investmentOutlook: { type: Schema.Types.Mixed, default: {} },
  technologyRadar: { type: [Schema.Types.Mixed], default: [] },
  personaBriefings: { type: [Schema.Types.Mixed], default: [] },
  riskRegister: { type: [Schema.Types.Mixed], default: [] },
  revenueOpportunities: { type: [Schema.Types.Mixed], default: [] },
  operationalPlan: { type: Schema.Types.Mixed, default: {} },
  aiNarrative: { type: Schema.Types.Mixed, default: {} },
  industryInsights: { type: Schema.Types.Mixed, default: {} },
  vendorEngagements: { type: [Schema.Types.Mixed], default: [] },
  deliveryTimeline: { type: [Schema.Types.Mixed], default: [] },
  strategicIntelligence: { type: Schema.Types.Mixed, default: {} },
  commandAdvisory: { type: Schema.Types.Mixed, default: {} },
  architectureUploads: { type: [Schema.Types.Mixed], default: [] },
  architectureSignals: { type: Schema.Types.Mixed, default: {} },
  paid: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Report', ReportSchema);
