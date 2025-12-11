const mongoose = require('mongoose');

const { Schema } = mongoose;

const OrganizationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    workosOrganizationId: { type: String, trim: true, unique: true, sparse: true },
    orgType: { type: String, enum: ['vendor', 'buyer', 'both'], default: 'both' },
    tier: { type: String, enum: ['personal', 'business'], default: 'business' },
    productAccess: { type: [String], default: [] },
    domains: { type: [String], default: [] },
    vendorSuiteEnabled: { type: Boolean, default: true },
    buyerSuiteEnabled: { type: Boolean, default: true },
    // vendorSuite = seats for vendor-only users
    // buyerSuite = seats for buyer-only users
    // bothSuites = seats for users who have both suites
    seatLimits: {
      vendorSuite: { type: Number, default: 100000 },
      buyerSuite: { type: Number, default: 100000 },
      bothSuites: { type: Number, default: 100000 }
    },
    billingProfile: { type: Schema.Types.Mixed, default: {} },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Organization', OrganizationSchema);
