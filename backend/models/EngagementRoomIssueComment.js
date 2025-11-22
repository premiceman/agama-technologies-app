const mongoose = require('mongoose');

const { Schema } = mongoose;

const EngagementRoomIssueCommentSchema = new Schema(
  {
    room: { type: Schema.Types.ObjectId, ref: 'EngagementRoom', required: true },
    issue: { type: Schema.Types.ObjectId, ref: 'EngagementRoomIssue', required: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('EngagementRoomIssueComment', EngagementRoomIssueCommentSchema);
