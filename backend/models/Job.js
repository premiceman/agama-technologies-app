const mongoose = require('mongoose');
const { Schema } = mongoose;

const JobSchema = new Schema(
  {
    type: { type: String, required: true, index: true },
    status: { type: String, enum: ['pending', 'running', 'done', 'error'], default: 'pending', index: true },
    payload: { type: Schema.Types.Mixed, default: {} },
    result: { type: Schema.Types.Mixed },
    attempts: { type: Number, default: 0 },
    workerId: { type: String },
    error: { type: String }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Job', JobSchema);
