import { Router } from 'express';
import VendorResponse from '../models/VendorResponse.js';
import Rfx from '../models/Rfx.js';
import { requireAuth } from '../middleware/auth.js';
import { recordAuditEvent } from '../utils/audit.js';
import { autoscoreVendorResponse } from '../services/openaiService.js';

const router = Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    let query;
    if (req.user.vendor_profile_id) {
      query = { vendorId: req.user.vendor_profile_id };
    } else {
      const projectIds = (req.user.project_roles || []).map((role) => role.projectId);
      const rfxForProjects = await Rfx.find({ projectId: { $in: projectIds } }, { _id: 1 }).lean();
      query = { rfxId: { $in: rfxForProjects.map((doc) => doc._id) } };
    }
    const responses = await VendorResponse.find(query).lean();
    res.json({ responses });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { rfxId, vendorId, answers } = req.body;
    const rfx = await Rfx.findById(rfxId);
    if (!rfx) {
      return res.status(404).json({ message: 'RFX not found' });
    }
    if (req.user.vendor_profile_id && req.user.vendor_profile_id.toString() !== vendorId) {
      return res.status(403).json({ message: 'Vendor scope mismatch' });
    }
    const hasProjectAccess = req.user.project_roles?.some((role) => role.projectId?.toString() === rfx.projectId.toString());
    if (!hasProjectAccess && req.user.vendor_profile_id?.toString() !== vendorId) {
      return res.status(403).json({ message: 'No access' });
    }
    const response = await VendorResponse.create({ rfxId, vendorId, answers });
    await recordAuditEvent({
      actorId: req.user._id || req.user.id,
      entityType: 'vendorResponse',
      entityId: response._id,
      action: 'create',
      diff: req.body
    });
    res.status(201).json({ response });
  } catch (err) {
    next(err);
  }
});

router.put('/:responseId', requireAuth, async (req, res, next) => {
  try {
    const response = await VendorResponse.findById(req.params.responseId);
    if (!response) {
      return res.status(404).json({ message: 'Response not found' });
    }
    if (req.user.vendor_profile_id && response.vendorId.toString() !== req.user.vendor_profile_id.toString()) {
      return res.status(403).json({ message: 'Vendor scope mismatch' });
    }
    Object.assign(response, req.body);
    await response.save();
    await recordAuditEvent({
      actorId: req.user._id || req.user.id,
      entityType: 'vendorResponse',
      entityId: response._id,
      action: 'update',
      diff: req.body
    });
    res.json({ response });
  } catch (err) {
    next(err);
  }
});

router.post('/:responseId/submit', requireAuth, async (req, res, next) => {
  try {
    const response = await VendorResponse.findById(req.params.responseId);
    if (!response) {
      return res.status(404).json({ message: 'Response not found' });
    }
    if (req.user.vendor_profile_id && response.vendorId.toString() !== req.user.vendor_profile_id.toString()) {
      return res.status(403).json({ message: 'Vendor scope mismatch' });
    }
    response.submittedAt = new Date();
    response.autoscore = await autoscoreVendorResponse(response.rfxId.toString(), response._id.toString());
    await response.save();
    await recordAuditEvent({
      actorId: req.user._id || req.user.id,
      entityType: 'vendorResponse',
      entityId: response._id,
      action: 'submit',
      diff: {}
    });
    res.json({ response });
  } catch (err) {
    next(err);
  }
});

export default router;
