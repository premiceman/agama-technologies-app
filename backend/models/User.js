import mongoose from 'mongoose';

const OrgRoleSchema = new mongoose.Schema(
  {
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organisation',
      required: true
    },
    role: {
      type: String,
      enum: ['owner', 'admin', 'editor', 'viewer'],
      required: true
    }
  },
  { _id: false }
);

const ProjectRoleSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true
    },
    role: {
      type: String,
      enum: ['admin', 'editor', 'viewer'],
      required: true
    }
  },
  { _id: false }
);

const UserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    name: { type: String, required: true },
    passwordHash: { type: String, required: true },
    org_roles: [OrgRoleSchema],
    project_roles: [ProjectRoleSchema],
    vendor_profile_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VendorProfile'
    }
  },
  { timestamps: true }
);

export default mongoose.model('User', UserSchema);
