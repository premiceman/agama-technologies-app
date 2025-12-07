const mongoose = require('mongoose');

const { Schema } = mongoose;

const AttachmentSchema = new Schema(
  {
    fileUrl: { type: String, required: true },
    fileName: { type: String, required: true }
  },
  { _id: false }
);

const BuyerCommentSchema = new Schema(
  {
    reviewerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    comment: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: true }
);

const RfxResponseSchema = new Schema(
  {
    roomId: { type: Schema.Types.ObjectId, ref: 'EngagementRoom' },
    rfxId: { type: Schema.Types.ObjectId, ref: 'Rfx', required: true, index: true },
    questionId: { type: Schema.Types.ObjectId, ref: 'RfxItem', required: true },
    vendorOrgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    buyerOrgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    answerText: { type: String, trim: true },
    answerNumeric: { type: Number },
    answerOptions: { type: [String], default: [] },
    attachments: { type: [AttachmentSchema], default: [] },
    submittedByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    submittedAt: { type: Date, default: Date.now },
    autoScore: { type: Number, min: 0, max: 100 },
    reviewScore: { type: Number, min: 0, max: 100 },
    buyerComments: { type: [BuyerCommentSchema], default: [] }
  },
  { timestamps: true }
);

module.exports = mongoose.model('RfxResponse', RfxResponseSchema);
