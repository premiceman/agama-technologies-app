const mongoose = require('mongoose');
const crypto = require('crypto');

const { Schema } = mongoose;

const EngagementRoomInviteSchema = new Schema(
  {
    room: { type: Schema.Types.ObjectId, ref: 'EngagementRoom', required: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    organization: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    role: { type: String, enum: ['room_admin', 'editor', 'viewer'], required: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'accepted', 'revoked', 'expired'], default: 'pending' },
    token: { type: String, required: true, unique: true, default: () => crypto.randomBytes(24).toString('hex') },
    isGuestInvite: { type: Boolean, default: false }
  },
  { timestamps: true }
);

module.exports = mongoose.model('EngagementRoomInvite', EngagementRoomInviteSchema);
