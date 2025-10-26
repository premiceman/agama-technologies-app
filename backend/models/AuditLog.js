const mongoose = require('mongoose');
const { Schema } = mongoose;

const AuditLogSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    action: { type: String, required: true },
    targetType: { type: String, required: true },
    targetId: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    ip: { type: String },
    ua: { type: String },
    ts: { type: Date, default: () => new Date() }
  },
  { timestamps: false }
);

module.exports = mongoose.model('AuditLog', AuditLogSchema);
