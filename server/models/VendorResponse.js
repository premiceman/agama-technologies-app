import mongoose from 'mongoose';

const AnswerSchema = new mongoose.Schema(
  {
    questionId: { type: String, required: true },
    text: { type: String },
    attachments: [{ type: String }]
  },
  { _id: false }
);

const VendorResponseSchema = new mongoose.Schema(
  {
    rfxId: { type: mongoose.Schema.Types.ObjectId, ref: 'Rfx', required: true },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'VendorProfile', required: true },
    answers: [AnswerSchema],
    autoscore: {
      bySection: { type: mongoose.Schema.Types.Mixed, default: {} },
      overall: { type: Number, default: 0 }
    },
    submittedAt: { type: Date }
  },
  { timestamps: true }
);

export default mongoose.model('VendorResponse', VendorResponseSchema);
