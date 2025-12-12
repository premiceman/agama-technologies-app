const mongoose = require('mongoose');

const { Schema } = mongoose;
const { DEFAULT_SANDBOX_ORG_ID } = require('../config/defaultOrg');

const EngagementRoomMembershipSchema = new Schema(
  {
    room: { type: Schema.Types.ObjectId, ref: 'EngagementRoom', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    organization: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: false,
      default: DEFAULT_SANDBOX_ORG_ID
    },
    role: { type: String, enum: ['room_admin', 'editor', 'viewer'], default: 'viewer' },
    isGuest: { type: Boolean, default: false }
  },
  { timestamps: true }
);

EngagementRoomMembershipSchema.index({ room: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('EngagementRoomMembership', EngagementRoomMembershipSchema);
