const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PaymentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true, required: true },
    amountCents: { type: Number, required: true },
    currency: { type: String, default: 'usd' },
    provider: { type: String, enum: ['stripe'], default: 'stripe' },
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending',
      index: true
    },
    tier: { type: String, enum: ['strategic', 'command'], required: true },
    stripeSessionId: { type: String, index: true },
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', PaymentSchema);
