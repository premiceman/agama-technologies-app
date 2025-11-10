import mongoose from 'mongoose';

const QuestionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    type: { type: String, required: true },
    text: { type: String, required: true },
    weight: { type: Number, default: 1 },
    options: [{ type: String }],
    level_map: { type: mongoose.Schema.Types.Mixed }
  },
  { _id: false }
);

const SectionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    weight: { type: Number, default: 1 },
    questions: [QuestionSchema]
  },
  { _id: false }
);

const MaturityModelSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    version: { type: String, required: true },
    schema: {
      sections: [SectionSchema]
    }
  },
  { timestamps: true }
);

MaturityModelSchema.index({ type: 1, version: 1 }, { unique: true });

export default mongoose.model('MaturityModel', MaturityModelSchema);
