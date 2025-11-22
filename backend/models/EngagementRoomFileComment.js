const mongoose = require('mongoose');

const { Schema } = mongoose;

const EngagementRoomFileCommentSchema = new Schema(
  {
    file: { type: Schema.Types.ObjectId, ref: 'EngagementRoomFile', required: true },
    version: { type: Schema.Types.ObjectId, ref: 'EngagementRoomFileVersion' },
    room: { type: Schema.Types.ObjectId, ref: 'EngagementRoom', required: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('EngagementRoomFileComment', EngagementRoomFileCommentSchema);
