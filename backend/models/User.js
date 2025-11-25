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
    company: { type: String, trim: true },
    role: { type: String, trim: true },
    industry: { type: String, trim: true },
    licenseTier: { type: String, enum: ['personal', 'business', 'guest'], default: 'personal' },
    licensePlan: {
      type: String,
      enum: ['free-personal', 'vendor-enterprise', 'procurement-enterprise', 'consulting-enterprise'],
      default: 'free-personal'
    },
    onboardingStatus: { type: String, enum: ['pending', 'in-progress', 'completed'], default: 'pending' },
    onboardingResponses: { type: Schema.Types.Mixed, default: {} },
    valueAssessmentLimit: { type: Number, default: 3 },
    billingProfile: { type: Schema.Types.Mixed, default: {} },
    platformAccess: { type: [String], default: ['valuesphere'] },
    persona: { type: String, enum: ['vendor', 'buyer', 'both', 'explorer', 'unknown', 'consultant'], default: 'unknown' },
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
    company: this.company,
    role: this.role,
    industry: this.industry,
    licenseTier: this.licenseTier,
    persona: this.persona || 'unknown',
    valuesphereMode: this.valuesphereMode || 'vendor',
    emailVerified: this.emailVerified,
    status: this.status,
    licensePlan: this.licensePlan || 'free-personal',
    onboardingStatus: this.onboardingStatus || 'pending',
    onboardingResponses: this.onboardingResponses || {},
    valueAssessmentLimit: this.valueAssessmentLimit,
    billingProfile: this.billingProfile || {},
    platformAccess: Array.isArray(this.platformAccess) ? [...this.platformAccess] : [],
    defaultOrganizationId: this.defaultOrganization ? this.defaultOrganization.toString() : null,
    lastLoginAt: this.lastLoginAt || null,
    createdAt: this.createdAt
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
  industry,
  licenseTier = 'personal',
  platformAccess = ['valuesphere'],
  licensePlan = licenseTier === 'business' ? 'consulting-enterprise' : 'free-personal',
  valueAssessmentLimit
}) {
  const salt = await bcrypt.genSalt(12);
  const hash = await bcrypt.hash(password, salt);
  return this.create({
    name,
    email: email.toLowerCase(),
    passwordHash: hash,
    company,
    role,
    industry,
    licenseTier,
    licensePlan,
    platformAccess,
    valueAssessmentLimit: licenseTier === 'personal' ? valueAssessmentLimit ?? 3 : null,
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
      licenseTier: 'personal',
      licensePlan: 'free-personal',
      platformAccess: ['valuesphere'],
      valueAssessmentLimit: 3
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

  if (!Array.isArray(user.platformAccess) || user.platformAccess.length === 0) {
    user.platformAccess = ['valuesphere'];
    changed = true;
  }

  if (!user.licenseTier) {
    user.licenseTier = 'personal';
    changed = true;
  }

  if (!user.licensePlan) {
    user.licensePlan = user.licenseTier === 'business' ? 'consulting-enterprise' : 'free-personal';
    changed = true;
  }

  if (user.valueAssessmentLimit === undefined && user.licenseTier === 'personal') {
    user.valueAssessmentLimit = 3;
    changed = true;
  }

  if (changed) {
    await user.save();
  }

  return user;
};

module.exports = mongoose.model('User', UserSchema);
