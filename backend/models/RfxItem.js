const mongoose = require('mongoose');

const { Schema } = mongoose;

const RfxItemSchema = new Schema(
  {
    rfxId: { type: Schema.Types.ObjectId, ref: 'Rfx', required: true, index: true },
    sectionId: { type: Schema.Types.ObjectId, required: true },
    prompt: { type: String, required: true, trim: true },
    type: { type: String, enum: ['text', 'multi', 'numeric', 'attachment'], default: 'text' },
    options: { type: [String], default: [] },
    weight: { type: Number, min: 0 },
    evaluationRubric: { type: String, trim: true },
    tags: { type: [String], default: [] },
    required: { type: Boolean, default: true },
    order: { type: Number, default: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.model('RfxItem', RfxItemSchema);
