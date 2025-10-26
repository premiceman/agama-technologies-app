const mongoose = require('mongoose');

const SectionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    prompts: { type: [String], default: [] },
    guidance: { type: String }
  },
  { _id: false }
);

const CriteriaSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    weight: { type: Number, default: 0 },
    description: { type: String }
  },
  { _id: false }
);

const RfpTemplateSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, index: true },
    capability: { type: String, required: true },
    industry: { type: String },
    sections: { type: [SectionSchema], default: [] },
    criteria: { type: [CriteriaSchema], default: [] }
  },
  { timestamps: true }
);

module.exports = mongoose.model('RfpTemplate', RfpTemplateSchema);
