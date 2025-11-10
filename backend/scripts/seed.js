import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

import User from '../models/User.js';
import Organisation from '../models/Organisation.js';
import BusinessUnit from '../models/BusinessUnit.js';
import Project from '../models/Project.js';
import MaturityModel from '../models/MaturityModel.js';
import Rfx from '../models/Rfx.js';
import VendorProfile from '../models/VendorProfile.js';

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/agama';

const maturityDomains = ['Data', 'AI/ML', 'Security', 'Observability', 'Infrastructure', 'Application', 'Network'];

const createMaturityModels = async () => {
  const promises = maturityDomains.map((domain) =>
    MaturityModel.findOneAndUpdate(
      { type: domain.toLowerCase(), version: 'v1' },
      {
        type: domain.toLowerCase(),
        version: 'v1',
        definition: {
          sections: [
            {
              id: `${domain.toLowerCase()}-strategy`,
              title: `${domain} Strategy`,
              weight: 1,
              questions: [
                {
                  id: `${domain.toLowerCase()}-vision`,
                  type: 'scale',
                  text: `How mature is your ${domain} capability (1-5)?`,
                  weight: 1,
                  level_map: {
                    '1': 'Initial',
                    '2': 'Emerging',
                    '3': 'Defined',
                    '4': 'Managed',
                    '5': 'Optimised'
                  }
                },
                {
                  id: `${domain.toLowerCase()}-evidence`,
                  type: 'text',
                  text: `Provide evidence or artefacts for ${domain} practices.`,
                  weight: 1
                }
              ]
            }
          ]
        }
      },
      { upsert: true, new: true }
    )
  );
  await Promise.all(promises);
};

const seed = async () => {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  await createMaturityModels();
  console.log('Seeded maturity models');

  let user = await User.findOne({ email: 'owner@agama.local' });
  if (!user) {
    user = await User.create({
      email: 'owner@agama.local',
      name: 'Agama Owner',
      passwordHash: await bcrypt.hash('Password123!', 10),
      org_roles: [],
      project_roles: []
    });
    console.log('Created owner user owner@agama.local / Password123!');
  }

  let organisation = await Organisation.findOne({ name: 'Agama Demo Org' });
  if (!organisation) {
    organisation = await Organisation.create({
      name: 'Agama Demo Org',
      industry: 'Technology',
      size: '500-1000',
      regions: ['Global']
    });
    console.log('Created demo organisation');
  }

  if (!user.org_roles.some((role) => role.orgId?.toString() === organisation._id.toString())) {
    user.org_roles.push({ orgId: organisation._id, role: 'owner' });
    await user.save();
  }

  let businessUnit = await BusinessUnit.findOne({ orgId: organisation._id, name: 'Core Platforms' });
  if (!businessUnit) {
    businessUnit = await BusinessUnit.create({ orgId: organisation._id, name: 'Core Platforms' });
  }

  let project = await Project.findOne({ name: 'Observability Modernisation 2026' });
  if (!project) {
    project = await Project.create({
      orgId: organisation._id,
      buId: businessUnit._id,
      name: 'Observability Modernisation 2026',
      purpose: 'Modernise observability stack with AI-driven insights',
      tags: ['observability', 'modernisation'],
      createdBy: user._id
    });
    console.log('Created demo project');
  }

  if (!user.project_roles.some((role) => role.projectId?.toString() === project._id.toString())) {
    user.project_roles.push({ projectId: project._id, role: 'admin' });
    await user.save();
  }

  let vendor = await VendorProfile.findOne({ orgName: 'Vendor One' });
  if (!vendor) {
    vendor = await VendorProfile.create({
      orgName: 'Vendor One',
      contacts: [{ name: 'Ava Vendor', email: 'ava@vendorone.com', role: 'Account Executive' }],
      capabilities: ['Observability Platform'],
      integrations: ['ServiceNow', 'PagerDuty'],
      certifications: ['ISO 27001'],
      pricingModels: ['Subscription']
    });
  }

  let rfx = await Rfx.findOne({ projectId: project._id });
  if (!rfx) {
    rfx = await Rfx.create({
      projectId: project._id,
      title: 'Observability Modernisation RFP',
      sections: [
        {
          id: 'business-context',
          title: 'Business Context',
          questions: [
            {
              id: 'bc-1',
              type: 'text',
              text: 'Describe transformation objectives and success measures.',
              weight: 2
            },
            {
              id: 'bc-2',
              type: 'multi-select',
              text: 'Select relevant operational metrics.',
              weight: 1,
              options: ['MTTR', 'Availability', 'Customer NPS']
            }
          ]
        },
        {
          id: 'technical-requirements',
          title: 'Technical Requirements',
          questions: [
            {
              id: 'tr-1',
              type: 'scored',
              text: 'Explain ingestion architecture and scale benchmarks.',
              weight: 3
            },
            {
              id: 'tr-2',
              type: 'evidence',
              text: 'Provide evidence of customer deployments at scale.',
              weight: 2
            },
            {
              id: 'tr-3',
              type: 'scored',
              text: 'Outline AI/ML roadmap and governance controls.',
              weight: 2
            }
          ]
        }
      ],
      weights: {
        'business-context': 0.4,
        'technical-requirements': 0.6
      },
      invitedVendorIds: [vendor._id.toString()]
    });
    console.log('Created sample RFX');
  }

  await mongoose.disconnect();
  console.log('Seed complete');
};

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
