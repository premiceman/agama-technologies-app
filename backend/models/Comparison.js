import mongoose from 'mongoose';

const ResultSchema = new mongoose.Schema(
  {
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VendorProfile',
      required: true
    },
    score: { type: Number, required: true },
    rank: { type: Number, required: true }
  },
  { _id: false }
);

const ComparisonSchema = new mongoose.Schema(
  {
    rfxId: { type: mongoose.Schema.Types.ObjectId, ref: 'Rfx', required: true },
    method: { type: String, required: true },
    weights: { type: mongoose.Schema.Types.Mixed, default: {} },
    results: [ResultSchema],
    commentary: { type: String }
  },
  { timestamps: true }
);

export default mongoose.model('Comparison', ComparisonSchema);
