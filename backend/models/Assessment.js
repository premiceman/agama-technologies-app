const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const AssessmentSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', index: true, required: true },
  assessmentType: { type: String, default: 'security' },
  stage: { type: String, enum: ['free', 'premium'], default: 'free' },
  vertical: { type: String, default: 'generic' },
  industry: { type: String, default: '' },
  companySize: { type: String, default: 'SMB' },
  region: { type: String, default: 'EMEA' },
  strategicDrivers: { type: [String], default: [] },
  organization: {
    name: { type: String, default: '' },
    extract: { type: String, default: '' },
    intel: { type: Schema.Types.Mixed, default: {} }
  },
  companyProfile: { type: Schema.Types.Mixed, default: {} },
  capabilityFocus: { type: [String], default: [] },
  techLandscape: { type: Schema.Types.Mixed, default: {} },
  vendorStrategy: { type: Schema.Types.Mixed, default: {} },
  operatingModel: { type: Schema.Types.Mixed, default: {} },
  personas: { type: [Schema.Types.Mixed], default: [] },
  answers: { type: Schema.Types.Mixed, default: {} },
  premiumAnswers: { type: Schema.Types.Mixed, default: {} }
}, { timestamps: true });

module.exports = mongoose.model('Assessment', AssessmentSchema);
