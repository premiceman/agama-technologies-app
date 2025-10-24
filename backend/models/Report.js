const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ReportSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', index: true, required: true },
  assessmentId: { type: Schema.Types.ObjectId, ref: 'Assessment', required: true },
  headlineScore: { type: Number, required: true },
  pillarScores: { type: Object, required: true },       // { Observability: 72, Security: 61, AIOps: 58, Analytics: 70 }
  benchmarks: { type: Object, required: true },         // industry medians, percentiles
  recommendations: { type: [String], default: [] },
  summary: { type: String, default: '' },
  paid: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Report', ReportSchema);
