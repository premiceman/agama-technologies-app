const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Schema = mongoose.Schema;

const UserSchema = new Schema(
  {
    name: { type: String, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String },
    workosUserId: { type: String, unique: true, sparse: true },
    emailVerified: { type: Boolean, default: false },
    status: { type: String, enum: ['active', 'deactivated'], default: 'active' },
    isStaff: { type: Boolean, default: false },
    company: { type: String, trim: true },
    role: { type: String, trim: true },
    industry: { type: String, trim: true },
    authSource: { type: String, enum: ['workos', 'local'], default: 'workos' },
    forceLogoutAt: { type: Date, default: null },
    onboardingStatus: { type: String, enum: ['pending', 'in-progress', 'completed'], default: 'pending' },
    onboardingResponses: { type: Schema.Types.Mixed, default: {} },
    billingProfile: { type: Schema.Types.Mixed, default: {} },
    persona: { type: String, enum: ['vendor', 'buyer', 'both'], default: 'both' },
    valuesphereMode: { type: String, enum: ['vendor', 'buyer'], default: 'vendor' },
    defaultOrganization: { type: Schema.Types.ObjectId, ref: 'Organization', default: null },
    lastLoginAt: { type: Date }
  },
  { timestamps: true }
);

UserSchema.methods.public = function() {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    workosUserId: this.workosUserId,
    authSource: this.authSource,
    company: this.company,
    role: this.role,
    industry: this.industry,
    persona: this.persona || 'both',
    valuesphereMode: this.valuesphereMode || 'vendor',
    emailVerified: this.emailVerified,
    status: this.status,
    onboardingStatus: this.onboardingStatus || 'pending',
    onboardingResponses: this.onboardingResponses || {},
    billingProfile: this.billingProfile || {},
    defaultOrganizationId: this.defaultOrganization ? this.defaultOrganization.toString() : null,
    lastLoginAt: this.lastLoginAt || null,
    createdAt: this.createdAt,

    // expose staff flag to the frontend
    isStaff: this.isStaff === true
  };
};

UserSchema.methods.verifyPassword = async function(password) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(password, this.passwordHash);
};

UserSchema.statics.createSecure = async function({
  name,
  email,
  password,
  company,
  role,
  industry
}) {
  const salt = await bcrypt.genSalt(12);
  const hash = await bcrypt.hash(password, salt);
  return this.create({
    name,
    email: email.toLowerCase(),
    passwordHash: hash,
    authSource: 'local',
    company,
    role,
    industry,
    defaultOrganization: null
  });
};

UserSchema.statics.findOrCreateFromWorkOSProfile = async function(profile) {
  const email = (profile.email || '').toLowerCase();
  const nameParts = [profile.firstName, profile.lastName].filter(Boolean);
  const fullName = nameParts.length > 0 ? nameParts.join(' ') : profile.email;

  let user = null;
  if (profile.id) {
    user = await this.findOne({ workosUserId: profile.id });
  }

  if (!user && email) {
    user = await this.findOne({ email });
  }

  if (!user) {
    user = await this.create({
      workosUserId: profile.id,
      email,
      name: fullName,
      passwordHash: null,
      authSource: 'workos'
    });
    return user;
  }

  let changed = false;

  if (!user.workosUserId && profile.id) {
    user.workosUserId = profile.id;
    changed = true;
  }

  if (email && user.email !== email) {
    user.email = email;
    changed = true;
  }

  if (!user.name && fullName) {
    user.name = fullName;
    changed = true;
  }

  if (user.authSource !== 'workos') {
    user.authSource = 'workos';
    changed = true;
  }

  if (changed) {
    await user.save();
  }

  return user;
};

module.exports = mongoose.model('User', UserSchema);
