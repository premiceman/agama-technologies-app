const mongoose = require('mongoose');

const { Schema } = mongoose;

const AdminConfigSchema = new Schema(
  {
    _id: { type: String, required: true },
    secretKey: { type: String, required: true },
    description: { type: String }
  },
  { timestamps: true }
);

// Seed manually: create a document with _id: 'agama-admin-console' and secretKey: 'mysupersecretkey' via MongoDB tools
// (Atlas/Compass) until an automated rotation flow is available.

module.exports = mongoose.model('AdminConfig', AdminConfigSchema);
