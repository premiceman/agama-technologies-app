import mongoose from 'mongoose';

const ConsultingSessionSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true
    },
    date: { type: Date, required: true },
    notes: { type: String },
    decisions: [{ type: String }],
    risks: [{ type: String }],
    actions: [{ type: String }]
  },
  { timestamps: true }
);

export default mongoose.model('ConsultingSession', ConsultingSessionSchema);
