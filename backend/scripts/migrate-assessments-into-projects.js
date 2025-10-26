#!/usr/bin/env node
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Assessment = require('../models/Assessment');
const Project = require('../models/Project');
const { computeProjectAnalyticsSnapshot } = require('../utils/analytics');

const CLI_DRY_RUN = process.argv.includes('--dry-run');

async function ensureConnection() {
  if (mongoose.connection.readyState === 1) {
    return false;
  }
  if (mongoose.connection.readyState === 2) {
    await new Promise((resolve, reject) => {
      mongoose.connection.once('open', resolve);
      mongoose.connection.once('error', reject);
    });
    return false;
  }
  if (mongoose.connection.readyState === 3) {
    await new Promise(resolve => {
      mongoose.connection.once('disconnected', resolve);
    });
  }
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/agama_tech';
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  return true;
}

function buildDefaultProjectPayload(assessment) {
  const name = 'Auto-imported Project';
  const industry = assessment.industry || 'General';
  const region = assessment.region || 'EMEA';
  const companySize = assessment.companySize || 'SMB';
  const payload = {
    userId: assessment.userId,
    name,
    industry,
    region,
    companySize,
    stage: assessment.stage,
    riskAppetite: assessment.projectSnapshot?.riskAppetite,
    strategicDrivers: assessment.strategicDrivers || [],
    capabilityFocus: assessment.capabilityFocus || [],
    overview: assessment.projectSnapshot?.overview || '',
    companyProfile: assessment.companyProfile || {},
    operatingModel: assessment.operatingModel || {},
    techLandscape: assessment.techLandscape || {},
    personas: assessment.personas || []
  };

  const snapshot = computeProjectAnalyticsSnapshot(payload);
  payload.analytics = {
    maturity: {
      overall: snapshot.readinessScore,
      pillars: { readiness: snapshot.readinessScore },
      lastUpdated: new Date()
    }
  };

  return payload;
}

async function migrate(options = {}) {
  const { dryRun = CLI_DRY_RUN } = options;
  const shouldDisconnect = await ensureConnection();

  const assessments = await Assessment.find({
    $or: [{ projectId: { $exists: false } }, { projectId: null }]
  });
  console.log(`Found ${assessments.length} assessments without a project.`);
  const cache = new Map();
  let linkedCount = 0;

  for (const assessment of assessments) {
    const key = assessment.userId.toString();
    let project = cache.get(key);

    if (!project) {
      project = await Project.findOne({ userId: assessment.userId, name: 'Auto-imported Project' });
      if (!project && assessment.projectSnapshot?.id) {
        project = await Project.findOne({ _id: assessment.projectSnapshot.id, userId: assessment.userId });
      }

      if (!project) {
        const payload = buildDefaultProjectPayload(assessment);
        if (dryRun) {
          project = new Project(payload);
          console.log(`[dry-run] Would create default project for user ${key}`);
        } else {
          project = await Project.create(payload);
          console.log(`Created default project ${project._id} for user ${key}`);
        }
      } else {
        console.log(`Reusing existing project ${project._id} for user ${key}`);
      }

      cache.set(key, project);
    }

    if (dryRun) {
      console.log(`[dry-run] Would link assessment ${assessment._id} to project ${project._id}`);
      continue;
    }

    assessment.projectId = project._id;
    assessment.projectSnapshot = project.public();
    await assessment.save();
    linkedCount += 1;
    console.log(`Linked assessment ${assessment._id} to project ${project._id}`);
  }

  if (shouldDisconnect) {
    await mongoose.disconnect();
  }
  console.log('Migration complete.');
  return { processed: assessments.length, linked: linkedCount, dryRun };
}

if (require.main === module) {
  migrate({ dryRun: CLI_DRY_RUN })
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Migration failed', err);
      process.exit(1);
    });
} else {
  module.exports = { migrate };
}
