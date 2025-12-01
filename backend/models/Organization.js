const mongoose = require('mongoose');

const { Schema } = mongoose;

const OrganizationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    workosOrganizationId: { type: String, trim: true, unique: true, sparse: true },
    orgType: { type: String, enum: ['vendor', 'buyer', 'both'], default: 'both' },
    // LEGACY FIELDS (kept for now)
    productAccess: { type: [String], default: [] },
    domains: { type: [String], default: [] },
    tier: { type: String, enum: ['personal', 'business'], default: 'business' },
    platformAccess: { type: [String], default: ['valuesphere'] },
    seatLimit: { type: Number, default: 10 },

    // NEW SUITE ENTITLEMENT FIELDS
    sellerSuiteEnabled: { type: Boolean, default: false },
    buyerSuiteEnabled: { type: Boolean, default: false },
    engagementRoomsEnabled: { type: Boolean, default: false },
    seatLimits: {
      sellerSuite: { type: Number, default: 0 },
      buyerSuite: { type: Number, default: 0 },
      engagementRooms: { type: Number, default: 0 }
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Organization', OrganizationSchema);
