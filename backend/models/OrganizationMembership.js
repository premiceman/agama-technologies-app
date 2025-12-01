const mongoose = require('mongoose');

const { Schema } = mongoose;

const OrganizationMembershipSchema = new Schema(
  {
    organization: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: {
      type: String,
      enum: ['owner', 'admin', 'member', 'viewer'],
      default: 'member'
    },
    status: {
      type: String,
      enum: ['active', 'invited', 'suspended', 'removed'],
      default: 'active'
    },
    roleOrigin: { type: String, enum: ['app', 'idp'], default: 'app' },
    invitedEmail: { type: String, trim: true },
    sellerSuiteProvisioned: { type: Boolean, default: false },
    buyerSuiteProvisioned: { type: Boolean, default: false },
    engagementRoomsProvisioned: { type: Boolean, default: false }
  },
  { timestamps: true }
);

OrganizationMembershipSchema.index({ organization: 1, user: 1 }, { unique: true });

OrganizationMembershipSchema.statics.countActiveSeats = function (organizationId) {
  return this.countDocuments({ organization: organizationId, status: 'active' });
};

OrganizationMembershipSchema.statics.findForUserAndOrg = function (userId, orgId) {
  return this.findOne({ user: userId, organization: orgId });
};

module.exports = mongoose.model('OrganizationMembership', OrganizationMembershipSchema);
