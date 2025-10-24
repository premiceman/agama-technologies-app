const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
  name: { type: String, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  company: { type: String, trim: true },
  role: { type: String, trim: true },
  industry: { type: String, trim: true },
}, { timestamps: true });

UserSchema.methods.public = function() {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    company: this.company,
    role: this.role,
    industry: this.industry,
    createdAt: this.createdAt
  };
};

UserSchema.methods.verifyPassword = async function(password) {
  return bcrypt.compare(password, this.passwordHash);
};

UserSchema.statics.createSecure = async function({ name, email, password, company, role, industry }) {
  const salt = await bcrypt.genSalt(12);
  const hash = await bcrypt.hash(password, salt);
  return this.create({ name, email: email.toLowerCase(), passwordHash: hash, company, role, industry });
};

module.exports = mongoose.model('User', UserSchema);
