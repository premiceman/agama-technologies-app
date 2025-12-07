const mongoose = require('mongoose');

const { Schema } = mongoose;

const OrganizationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    workosOrganizationId: { type: String, trim: true, unique: true, sparse: true },
    orgType: { type: String, enum: ['vendor', 'buyer', 'both'], default: 'both' },
    productAccess: { type: [String], default: [] },
    domains: { type: [String], default: [] },
    tier: { type: String, enum: ['personal', 'business'], default: 'business' },
    platformAccess: { type: [String], default: ['valuesphere'] },
    seatLimit: { type: Number, default: 10 },

    vendorSuiteEnabled: { type: Boolean, default: false },
    buyerSuiteEnabled: { type: Boolean, default: false },
    sharedSuiteEnabled: { type: Boolean, default: true },
    seatLimits: {
      vendorSuite: { type: Number, default: 0 },
      buyerSuite: { type: Number, default: 0 },
      sharedSuite: { type: Number, default: 0 }
    },
    billingProfile: { type: Schema.Types.Mixed, default: {} },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Organization', OrganizationSchema);
