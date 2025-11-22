const mongoose = require('mongoose');

const { Schema } = mongoose;

const EngagementRoomFileSchema = new Schema(
  {
    room: { type: Schema.Types.ObjectId, ref: 'EngagementRoom', required: true },
    name: { type: String, required: true, trim: true },
    mimeType: { type: String, required: true, trim: true },
    currentVersion: { type: Schema.Types.ObjectId, ref: 'EngagementRoomFileVersion' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('EngagementRoomFile', EngagementRoomFileSchema);
