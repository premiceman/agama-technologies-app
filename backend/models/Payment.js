const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PaymentSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', index: true, required: true },
  reportId: { type: Schema.Types.ObjectId, ref: 'Report', required: true },
  amount: { type: Number, default: 0 },
  currency: { type: String, default: 'GBP' },
  status: { type: String, default: 'unpaid' }
}, { timestamps: true });

module.exports = mongoose.model('Payment', PaymentSchema);
