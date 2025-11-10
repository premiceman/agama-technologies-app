const mongoose = require('mongoose');

const VendorSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    categories: { type: [String], default: [] },
    strengths: { type: [String], default: [] },
    caveats: { type: [String], default: [] },
    pricingNotes: { type: String },
    integrationMatrix: { type: mongoose.Schema.Types.Mixed, default: {} },
    references: { type: [mongoose.Schema.Types.Mixed], default: [] }
  },
  { timestamps: true }
);

VendorSchema.index({ name: 'text', strengths: 'text', categories: 'text' });

module.exports = mongoose.model('Vendor', VendorSchema);
