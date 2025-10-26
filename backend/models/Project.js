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
    readinessScore: { type: Number, default: 0 },
    clarityScore: { type: Number, default: 0 },
    sentiment: { type: String, default: '' },
    driverCount: { type: Number, default: 0 },
    focusCount: { type: Number, default: 0 },
    stage: { type: String, default: '' },
    riskAppetite: { type: String, default: '' },
    maturity: {
      overall: { type: Number, default: 0 },
      pillars: { type: Schema.Types.Mixed, default: {} },
      delta: { type: Schema.Types.Mixed, default: { overall: 0, pillars: {} } },
      history: { type: Schema.Types.Mixed, default: { overall: [], pillars: {} } },
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
      readinessScore: this.analytics?.readinessScore ?? 0,
      clarityScore: this.analytics?.clarityScore ?? 0,
      sentiment: this.analytics?.sentiment || '',
      driverCount: this.analytics?.driverCount ?? 0,
      focusCount: this.analytics?.focusCount ?? 0,
      stage: this.analytics?.stage || this.stage || '',
      riskAppetite: this.analytics?.riskAppetite || this.riskAppetite || '',
      maturity: {
        overall: this.analytics?.maturity?.overall ?? 0,
        pillars: this.analytics?.maturity?.pillars || {},
        delta: this.analytics?.maturity?.delta || { overall: 0, pillars: {} },
        history: this.analytics?.maturity?.history || { overall: [], pillars: {} },
        lastUpdated: this.analytics?.maturity?.lastUpdated || null
      },
      timeseriesId: this.analytics?.timeseriesId || null
    },
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

module.exports = mongoose.model('Project', ProjectSchema);
