const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const EntitlementSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tier: { type: String, enum: ['free', 'strategic', 'command'], required: true },
    expiresAt: { type: Date }
  },
  { timestamps: true }
);

EntitlementSchema.index({ userId: 1, tier: 1 }, { unique: true });

module.exports = mongoose.model('Entitlement', EntitlementSchema);
