const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const AssessmentSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', index: true, required: true },
  vertical: { type: String, default: 'generic' },
  companySize: { type: String, default: 'SMB' },
  region: { type: String, default: 'EMEA' },
  answers: { type: Object, default: {} } // { pillar: { qid: 0-5, ... }, ... }
}, { timestamps: true });

module.exports = mongoose.model('Assessment', AssessmentSchema);
