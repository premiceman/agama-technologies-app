import mongoose from 'mongoose';

const ProjectSchema = new mongoose.Schema(
  {
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organisation', required: true },
    buId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessUnit' },
    name: { type: String, required: true },
    purpose: { type: String },
    tags: [{ type: String }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

export default mongoose.model('Project', ProjectSchema);
