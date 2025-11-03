import mongoose from 'mongoose';

const QuestionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    type: { type: String, required: true },
    text: { type: String, required: true },
    weight: { type: Number, default: 1 },
    options: [{ type: String }],
    requiresEvidence: { type: Boolean, default: false }
  },
  { _id: false }
);

const SectionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    questions: [QuestionSchema]
  },
  { _id: false }
);

const RfxSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    title: { type: String, required: true },
    sections: [SectionSchema],
    weights: { type: mongoose.Schema.Types.Mixed, default: {} },
    invitedVendorIds: [{ type: String }]
  },
  { timestamps: true }
);

export default mongoose.model('Rfx', RfxSchema);
