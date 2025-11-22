const mongoose = require('mongoose');

const { Schema } = mongoose;

const EngagementRoomIssueSchema = new Schema(
  {
    room: { type: Schema.Types.ObjectId, ref: 'EngagementRoom', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    status: {
      type: String,
      enum: ['not_started', 'in_progress', 'completed', 'stuck'],
      default: 'not_started'
    },
    assignees: { type: [Schema.Types.ObjectId], ref: 'User', default: [] },
    dueDate: { type: Date },
    notes: { type: String, trim: true },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('EngagementRoomIssue', EngagementRoomIssueSchema);
