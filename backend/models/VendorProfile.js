import mongoose from 'mongoose';

const ContactSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    role: { type: String }
  },
  { _id: false }
);

const VendorProfileSchema = new mongoose.Schema(
  {
    orgName: { type: String, required: true },
    contacts: [ContactSchema],
    capabilities: [{ type: String }],
    integrations: [{ type: String }],
    certifications: [{ type: String }],
    pricingModels: [{ type: String }]
  },
  { timestamps: true }
);

export default mongoose.model('VendorProfile', VendorProfileSchema);
