const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ScoreSchema = new Schema({
  overall: { type: Number, required: true },
  pillars: { type: Schema.Types.Mixed, default: {} }
}, { _id: false });

const MaturityTimepointSchema = new Schema({
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', index: true, required: true },
  assessmentId: { type: Schema.Types.ObjectId, ref: 'Assessment', index: true, required: true },
  domain: { type: String, default: 'overall' },
  scores: { type: ScoreSchema, required: true },
  computedAt: { type: Date, default: Date.now }
}, { timestamps: false });

MaturityTimepointSchema.index({ projectId: 1, computedAt: -1 });

module.exports = mongoose.model('MaturityTimepoint', MaturityTimepointSchema);
