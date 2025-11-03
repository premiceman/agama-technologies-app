import mongoose from 'mongoose';

const BusinessUnitSchema = new mongoose.Schema(
  {
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organisation', required: true },
    name: { type: String, required: true }
  },
  { timestamps: true }
);

export default mongoose.model('BusinessUnit', BusinessUnitSchema);
