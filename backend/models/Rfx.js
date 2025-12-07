const mongoose = require('mongoose');

const { Schema } = mongoose;

const RfxSectionSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    weight: { type: Number, min: 0 },
    order: { type: Number, default: 0 }
  },
  { _id: true, timestamps: true }
);

const RfxSchema = new Schema(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    sourcingEventId: { type: Schema.Types.ObjectId, ref: 'SourcingEvent' },
    topicArea: { type: String, required: true, trim: true },
    overallWeight: { type: Number, min: 0 },
    status: {
      type: String,
      enum: ['draft', 'issued', 'responding', 'evaluation', 'shortlist', 'decision', 'closed'],
      default: 'draft'
    },
    issuedAt: { type: Date },
    closeResponsesAt: { type: Date },
    createdByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    sections: { type: [RfxSectionSchema], default: [] }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Rfx', RfxSchema);
