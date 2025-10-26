const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const SourceSchema = new Schema({
  type: { type: String, enum: ['manual', 'csv'], required: true },
  url: { type: String, default: '' },
  confidence: { type: Number, enum: [0, 1, 2], default: 1 }
}, { _id: false });

const BusinessMetricSchema = new Schema({
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', index: true, required: true },
  year: { type: Number, required: true },
  arrUSD: { type: Number, default: null },
  headcount: { type: Number, default: null },
  source: { type: SourceSchema, required: true },
  notes: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: false });

BusinessMetricSchema.index({ projectId: 1, year: -1 }, { unique: true });

module.exports = mongoose.model('BusinessMetric', BusinessMetricSchema);
