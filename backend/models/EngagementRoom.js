const mongoose = require('mongoose');

const { Schema } = mongoose;
const { DEFAULT_SANDBOX_ORG_ID } = require('../config/defaultOrg');

const EngagementRoomSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    vendorOrg: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: false,
      default: DEFAULT_SANDBOX_ORG_ID
    },
    buyerOrg: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: false,
      default: DEFAULT_SANDBOX_ORG_ID
    },
    revenueAccount: { type: Schema.Types.ObjectId, ref: 'RevenueAccount' },
    procurementVendor: { type: Schema.Types.ObjectId, ref: 'ProcurementVendor' },
    status: { type: String, enum: ['draft', 'active', 'closed', 'archived'], default: 'draft' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    lastActivityAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

module.exports = mongoose.model('EngagementRoom', EngagementRoomSchema);
