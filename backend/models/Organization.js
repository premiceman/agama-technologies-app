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
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Organization', OrganizationSchema);
