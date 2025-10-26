const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ProjectSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', index: true, required: true },
  name: { type: String, required: true, trim: true },
  slug: { type: String, trim: true, index: true },
  companyDomain: { type: String, trim: true },
  industry: { type: String, trim: true },
  region: { type: String, trim: true },
  companySize: { type: String, trim: true },
  headcount: { type: Number, default: 0 },
  stage: { type: String, trim: true },
  riskAppetite: { type: String, trim: true },
  strategicDrivers: { type: [String], default: [] },
  capabilityFocus: { type: [String], default: [] },
  overview: { type: String, trim: true },
  companyProfile: { type: Schema.Types.Mixed, default: {} },
  operatingModel: { type: Schema.Types.Mixed, default: {} },
  techLandscape: { type: Schema.Types.Mixed, default: {} },
  personas: { type: [Schema.Types.Mixed], default: [] },
  analytics: {
    maturity: {
      overall: { type: Number, default: 0 },
      pillars: { type: Schema.Types.Mixed, default: {} },
      lastUpdated: { type: Date }
    },
    timeseriesId: { type: Schema.Types.ObjectId, ref: 'ProjectAnalyticsSeries' }
  }
}, { timestamps: true });

ProjectSchema.pre('save', function(next) {
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  }
  next();
});

ProjectSchema.methods.public = function() {
  return {
    id: this._id,
    name: this.name,
    slug: this.slug,
    companyDomain: this.companyDomain,
    industry: this.industry,
    region: this.region,
    companySize: this.companySize,
    headcount: this.headcount,
    stage: this.stage,
    riskAppetite: this.riskAppetite,
    strategicDrivers: this.strategicDrivers,
    capabilityFocus: this.capabilityFocus,
    overview: this.overview,
    companyProfile: this.companyProfile || {},
    operatingModel: this.operatingModel || {},
    techLandscape: this.techLandscape || {},
    personas: this.personas || [],
    analytics: {
      maturity: {
        overall: this.analytics?.maturity?.overall ?? 0,
        pillars: this.analytics?.maturity?.pillars || {},
        lastUpdated: this.analytics?.maturity?.lastUpdated || null
      },
      timeseriesId: this.analytics?.timeseriesId || null
    },
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

module.exports = mongoose.model('Project', ProjectSchema);
