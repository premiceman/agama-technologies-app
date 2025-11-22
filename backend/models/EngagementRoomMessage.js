const mongoose = require('mongoose');

const { Schema } = mongoose;

const EngagementRoomMessageSchema = new Schema(
  {
    room: { type: Schema.Types.ObjectId, ref: 'EngagementRoom', required: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, trim: true },
    type: { type: String, enum: ['message', 'system', 'ai_summary'], default: 'message' },
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

module.exports = mongoose.model('EngagementRoomMessage', EngagementRoomMessageSchema);
