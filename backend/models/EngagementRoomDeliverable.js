const mongoose = require('mongoose');

const { Schema } = mongoose;

const EngagementRoomDeliverableSchema = new Schema(
  {
    room: { type: Schema.Types.ObjectId, ref: 'EngagementRoom', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    status: {
      type: String,
      enum: ['not_started', 'in_progress', 'completed', 'at_risk'],
      default: 'not_started'
    },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    relatedIssues: { type: [Schema.Types.ObjectId], ref: 'EngagementRoomIssue', default: [] },
    dueDate: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('EngagementRoomDeliverable', EngagementRoomDeliverableSchema);
