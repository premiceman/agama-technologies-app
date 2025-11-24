const mongoose = require('mongoose');

const { Schema } = mongoose;

const AuditEventSchema = new Schema(
  {
    type: { type: String, required: true },
    actorUser: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    actorOrganization: { type: Schema.Types.ObjectId, ref: 'Organization', default: null },
    targetUser: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    targetOrganization: { type: Schema.Types.ObjectId, ref: 'Organization', default: null },
    targetRoom: { type: Schema.Types.ObjectId, ref: 'EngagementRoom', default: null },
    metadata: { type: Schema.Types.Mixed }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

module.exports = mongoose.model('AuditEvent', AuditEventSchema);
