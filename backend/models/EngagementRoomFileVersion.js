const mongoose = require('mongoose');

const { Schema } = mongoose;

const EngagementRoomFileVersionSchema = new Schema(
  {
    file: { type: Schema.Types.ObjectId, ref: 'EngagementRoomFile', required: true },
    storageKey: { type: String, required: true, trim: true },
    sizeBytes: { type: Number, required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    uploadedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

module.exports = mongoose.model('EngagementRoomFileVersion', EngagementRoomFileVersionSchema);
