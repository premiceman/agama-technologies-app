const { z } = require('zod');
const Vendor = require('../models/Vendor');

let computeScoreSummaryRef;
function ensureComputeScoreSummary() {
  if (!computeScoreSummaryRef) {
    ({ computeScoreSummary: computeScoreSummaryRef } = require('./scoring'));
  }
  return computeScoreSummaryRef;
}

const scoringToolSchema = z.object({
  answers: z.record(z.any()).default({}),
  vertical: z.string().optional(),
  companySize: z.string().optional()
});

async function scoringCompute(args = {}) {
  const parsed = scoringToolSchema.parse(args);
  const summary = ensureComputeScoreSummary()({
    answers: parsed.answers,
    vertical: parsed.vertical,
    companySize: parsed.companySize
  });
  return summary;
}

const vendorToolSchema = z.object({
  projectId: z.string().optional(),
  capability: z.string().optional(),
  categories: z.array(z.string()).max(10).optional(),
  query: z.string().optional(),
  strengths: z.array(z.string()).max(10).optional(),
  constraints: z
    .object({
      pricing: z.string().optional(),
      integrationNeeds: z.array(z.string()).max(10).optional()
    })
    .optional()
});

function scoreVendor(vendor, filters) {
  let score = 0;
  const reasons = [];
  const categories = vendor.categories || [];
  const strengths = vendor.strengths || [];
  const caveats = vendor.caveats || [];

  if (filters.capability) {
    const cap = filters.capability.toLowerCase();
    if (categories.some(cat => cat.toLowerCase().includes(cap))) {
      score += 3;
      reasons.push('Capability alignment');
    }
    if (strengths.some(str => str.toLowerCase().includes(cap))) {
      score += 2;
      reasons.push('Strength match');
    }
  }

  if (filters.categories?.length) {
    const matches = filters.categories.filter(cat =>
      categories.some(vcat => vcat.toLowerCase() === cat.toLowerCase())
    );
    if (matches.length) {
      score += matches.length * 2;
      reasons.push(`Category overlap: ${matches.join(', ')}`);
    }
  }

  if (filters.strengths?.length) {
    const matches = filters.strengths.filter(str =>
      strengths.some(v => v.toLowerCase().includes(str.toLowerCase()))
    );
    if (matches.length) {
      score += matches.length;
      reasons.push(`Strength overlap: ${matches.join(', ')}`);
    }
  }

  if (filters.query) {
    const q = filters.query.toLowerCase();
    if (vendor.name?.toLowerCase().includes(q)) {
      score += 1.5;
      reasons.push('Query match: name');
    }
    if (strengths.some(str => str.toLowerCase().includes(q))) {
      score += 1;
      reasons.push('Query match: strengths');
    }
  }

  if (filters.constraints?.pricing && vendor.pricingNotes) {
    const pricing = filters.constraints.pricing.toLowerCase();
    if (vendor.pricingNotes.toLowerCase().includes(pricing)) {
      score += 1;
      reasons.push('Pricing alignment');
    }
  }

  if (filters.constraints?.integrationNeeds?.length && vendor.integrationMatrix) {
    const integrations = Object.keys(vendor.integrationMatrix || {});
    const matches = filters.constraints.integrationNeeds.filter(need =>
      integrations.some(integration => integration.toLowerCase().includes(need.toLowerCase()))
    );
    if (matches.length) {
      score += matches.length;
      reasons.push(`Integration support: ${matches.join(', ')}`);
    }
  }

  if (filters.constraints?.avoidTerms?.length) {
    const avoid = filters.constraints.avoidTerms;
    if (avoid.some(term => caveats.some(c => c.toLowerCase().includes(term.toLowerCase())))) {
      score -= 2;
      reasons.push('Constraint conflict');
    }
  }

  return { score, reasons };
}

async function vendorMatch(args = {}) {
  const filters = vendorToolSchema.parse(args);
  const vendors = await Vendor.find({}).lean();
  const ranked = vendors
    .map(vendor => {
      const { score, reasons } = scoreVendor(vendor, filters);
      return { vendor, score, reasons };
    })
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(entry => ({
      slug: entry.vendor.slug,
      name: entry.vendor.name,
      categories: entry.vendor.categories,
      strengths: entry.vendor.strengths,
      caveats: entry.vendor.caveats,
      pricingNotes: entry.vendor.pricingNotes,
      integrationMatrix: entry.vendor.integrationMatrix,
      references: entry.vendor.references,
      score: Number(entry.score.toFixed(2)),
      reasons: entry.reasons
    }));

  return { matches: ranked };
}

const financialToolSchema = z.object({
  investment: z.number().nonnegative(),
  annualBenefit: z.number().nonnegative().optional(),
  monthlyBenefit: z.number().nonnegative().optional(),
  durationMonths: z.number().int().positive().optional(),
  discountRate: z.number().nonnegative().max(1).optional()
});

function calcFinancials(args = {}) {
  const parsed = financialToolSchema.parse(args);
  const monthlyBenefit = parsed.monthlyBenefit || (parsed.annualBenefit ? parsed.annualBenefit / 12 : 0);
  const paybackMonths = monthlyBenefit ? parsed.investment / monthlyBenefit : null;
  const discountRate = parsed.discountRate ?? 0.1;
  const duration = parsed.durationMonths ?? 36;

  let npv = -parsed.investment;
  if (monthlyBenefit) {
    for (let month = 1; month <= duration; month += 1) {
      npv += monthlyBenefit / Math.pow(1 + discountRate / 12, month);
    }
  }

  return {
    monthlyBenefit,
    paybackMonths: paybackMonths ? Number(paybackMonths.toFixed(2)) : null,
    npv: Number(npv.toFixed(2)),
    durationMonths: duration,
    discountRate
  };
}

const ragToolSchema = z.object({
  query: z.string(),
  filters: z.record(z.any()).optional()
});

function ragQuery(args = {}) {
  ragToolSchema.parse(args);
  return [];
}

const toolRegistry = {
  'scoring.compute': {
    name: 'scoring.compute',
    description: 'Compute maturity scores from structured answers to inform reporting narratives.',
    schema: scoringToolSchema,
    handler: scoringCompute
  },
  'vendor.match': {
    name: 'vendor.match',
    description: 'Look up vendors that align to capability needs, categories, and constraints.',
    schema: vendorToolSchema,
    handler: vendorMatch
  },
  'calc.financials': {
    name: 'calc.financials',
    description: 'Calculate payback and NPV for an initiative using investment and benefit inputs.',
    schema: financialToolSchema,
    handler: calcFinancials
  },
  'rag.query': {
    name: 'rag.query',
    description: 'Search retrieval augmented knowledge base for supporting evidence.',
    schema: ragToolSchema,
    handler: ragQuery
  }
};

module.exports = {
  toolRegistry,
  scoringCompute,
  vendorMatch,
  calcFinancials,
  ragQuery
};
