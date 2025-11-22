const mongoose = require('mongoose');

const { Schema } = mongoose;

const EngagementRoomSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    vendorOrg: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    buyerOrg: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    revenueAccount: { type: Schema.Types.ObjectId, ref: 'RevenueAccount' },
    procurementVendor: { type: Schema.Types.ObjectId, ref: 'ProcurementVendor' },
    status: { type: String, enum: ['active', 'archived'], default: 'active' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    lastActivityAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

module.exports = mongoose.model('EngagementRoom', EngagementRoomSchema);
