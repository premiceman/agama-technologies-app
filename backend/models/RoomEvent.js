const mongoose = require('mongoose');

const { Schema } = mongoose;

const RoomEventSchema = new Schema(
  {
    type: { type: String, required: true },
    room: { type: Schema.Types.ObjectId, ref: 'EngagementRoom', required: true },
    actorUser: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    actorOrganization: { type: Schema.Types.ObjectId, ref: 'Organization', default: null },
    targetUser: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    targetOrganization: { type: Schema.Types.ObjectId, ref: 'Organization', default: null },
    visibility: {
      type: String,
      enum: ['shared', 'vendor_only', 'buyer_only'],
      default: 'shared'
    },
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

module.exports = mongoose.model('RoomEvent', RoomEventSchema);
