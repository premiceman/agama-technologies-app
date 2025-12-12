const mongoose = require('mongoose');
const { PUBLIC_ORGANIZATION_PLACEHOLDER_ID } = require('../utils/organizationPlaceholders');

const { Schema } = mongoose;
const { DEFAULT_SANDBOX_ORG_ID } = require('../config/defaultOrg');

const QuestionSchema = new Schema(
  {
    questionId: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    helpText: { type: String, trim: true },
    type: { type: String, enum: ['text', 'numeric', 'select', 'multi', 'boolean'], default: 'text' },
    options: { type: [String], default: [] },
    weight: { type: Number, default: 0 },
    isKeyDriver: { type: Boolean, default: false }
  },
  { _id: false }
);

const SectionSchema = new Schema(
  {
    sectionId: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    weight: { type: Number, default: 0 },
    questions: { type: [QuestionSchema], default: [] }
  },
  { _id: false }
);

const ValueSphereTemplateSchema = new Schema(
  {
    organization: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: false,
      default: DEFAULT_SANDBOX_ORG_ID
    },
    mode: { type: String, enum: ['seller', 'buyer', 'shared'], required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    sections: { type: [SectionSchema], default: [] },
    versionNumber: { type: Number, default: 1 },
    changeSummary: { type: String, trim: true },
    previousVersion: { type: Schema.Types.ObjectId, ref: 'ValueSphereTemplate', default: null },
    isDeprecated: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('ValueSphereTemplate', ValueSphereTemplateSchema);
