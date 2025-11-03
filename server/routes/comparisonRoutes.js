import { Router } from 'express';
import Comparison from '../models/Comparison.js';
import VendorResponse from '../models/VendorResponse.js';
import Rfx from '../models/Rfx.js';
import { requireAuth } from '../middleware/auth.js';
import { recordAuditEvent } from '../utils/audit.js';
import { composeComparisonNarrative } from '../services/openaiService.js';

const router = Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const projectIds = (req.user.project_roles || []).map((role) => role.projectId);
    const rfxDocs = await Rfx.find({ projectId: { $in: projectIds } }, { _id: 1 }).lean();
    const comparisons = await Comparison.find({ rfxId: { $in: rfxDocs.map((doc) => doc._id) } }).lean();
    res.json({ comparisons });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { rfxId, method, weights, vendorIds } = req.body;
    const rfx = await Rfx.findById(rfxId);
    if (!rfx) {
      return res.status(404).json({ message: 'RFX not found' });
    }
    const hasAccess = req.user.project_roles?.some((role) => role.projectId?.toString() === rfx.projectId.toString());
    if (!hasAccess) {
      return res.status(403).json({ message: 'No project access' });
    }
    const query = { rfxId };
    if (Array.isArray(vendorIds) && vendorIds.length > 0) {
      query.vendorId = { $in: vendorIds };
    }
    const responses = await VendorResponse.find(query).lean();
    const results = responses
      .map((response) => ({
        vendorId: response.vendorId,
        score: response.autoscore?.overall || 0
      }))
      .sort((a, b) => b.score - a.score)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));
    const narrative = await composeComparisonNarrative(rfxId.toString(), 'preview');
    const comparison = await Comparison.create({
      rfxId,
      method,
      weights,
      results,
      commentary: typeof narrative === 'string' ? narrative : JSON.stringify(narrative)
    });
    await recordAuditEvent({
      actorId: req.user._id || req.user.id,
      entityType: 'comparison',
      entityId: comparison._id,
      action: 'create',
      diff: req.body
    });
    res.status(201).json({ comparison });
  } catch (err) {
    next(err);
  }
});

router.get('/:comparisonId', requireAuth, async (req, res, next) => {
  try {
    const comparison = await Comparison.findById(req.params.comparisonId).lean();
    if (!comparison) {
      return res.status(404).json({ message: 'Comparison not found' });
    }
    const rfx = await Rfx.findById(comparison.rfxId);
    const hasAccess = req.user.project_roles?.some((role) => role.projectId?.toString() === rfx.projectId.toString());
    if (!hasAccess) {
      return res.status(403).json({ message: 'No project access' });
    }
    res.json({ comparison });
  } catch (err) {
    next(err);
  }
});

export default router;
