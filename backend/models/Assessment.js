import mongoose from 'mongoose';

const ResponseSchema = new mongoose.Schema(
  {
    questionId: { type: String, required: true },
    value: { type: mongoose.Schema.Types.Mixed },
    evidenceIds: [{ type: String }]
  },
  { _id: false }
);

const AssessmentSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    type: { type: String, required: true },
    modelVersion: { type: String },
    responses: [ResponseSchema],
    scores: {
      bySection: { type: mongoose.Schema.Types.Mixed, default: {} },
      overall: { type: Number, default: 0 }
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

export default mongoose.model('Assessment', AssessmentSchema);
