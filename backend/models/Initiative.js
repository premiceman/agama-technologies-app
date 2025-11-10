const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ImpactedPillarSchema = new Schema({
  pillar: { type: String, required: true },
  expectedImpact: { type: Number, min: -3, max: 3, required: true }
}, { _id: false });

const InitiativeSchema = new Schema({
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', index: true, required: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '', trim: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date },
  impactedPillars: { type: [ImpactedPillarSchema], default: [] },
  status: { type: String, enum: ['planned', 'in-progress', 'done'], default: 'planned' },
  owner: { type: String, default: '', trim: true }
}, { timestamps: true });

module.exports = mongoose.model('Initiative', InitiativeSchema);
