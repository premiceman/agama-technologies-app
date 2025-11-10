import mongoose from 'mongoose';

const OrganisationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    industry: { type: String },
    size: { type: String },
    regions: [{ type: String }],
    settings: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

export default mongoose.model('Organisation', OrganisationSchema);
