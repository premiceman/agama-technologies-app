const mongoose = require('mongoose');

const { Schema } = mongoose;

const BuyerValueAssessmentSchema = new Schema(
  {
    organization: { type: Schema.Types.ObjectId, ref: 'Organization', default: null },
    procurementVendor: { type: Schema.Types.ObjectId, ref: 'ProcurementVendor', default: null },
    vendorName: { type: String, required: true, trim: true },
    title: { type: String, trim: true },
    dimensions: { type: [Schema.Types.Mixed], default: [] },
    summary: { type: String, trim: true },
    tags: { type: [String], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('BuyerValueAssessment', BuyerValueAssessmentSchema);
