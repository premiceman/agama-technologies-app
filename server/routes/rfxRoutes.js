import { Router } from 'express';
import Rfx from '../models/Rfx.js';
import Project from '../models/Project.js';
import VendorProfile from '../models/VendorProfile.js';
import { requireAuth } from '../middleware/auth.js';
import { recordAuditEvent } from '../utils/audit.js';
import { draftRfx } from '../services/openaiService.js';

const router = Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const projectIds = (req.user.project_roles || []).map((role) => role.projectId);
    const rfxList = await Rfx.find({ projectId: { $in: projectIds } }).lean();
    res.json({ rfx: rfxList });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { projectId } = req.body;
    const hasAccess = req.user.project_roles?.some((role) => role.projectId?.toString() === projectId?.toString());
    if (!hasAccess) {
      return res.status(403).json({ message: 'No project access' });
    }
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    const rfx = await Rfx.create(req.body);
    await recordAuditEvent({
      actorId: req.user._id || req.user.id,
      entityType: 'rfx',
      entityId: rfx._id,
      action: 'create',
      diff: req.body
    });
    res.status(201).json({ rfx });
  } catch (err) {
    next(err);
  }
});

router.post('/:rfxId/invite', requireAuth, async (req, res, next) => {
  try {
    const rfx = await Rfx.findById(req.params.rfxId);
    if (!rfx) {
      return res.status(404).json({ message: 'RFX not found' });
    }
    const hasAccess = req.user.project_roles?.some((role) => role.projectId?.toString() === rfx.projectId.toString());
    if (!hasAccess) {
      return res.status(403).json({ message: 'No project access' });
    }
    const { vendorId } = req.body;
    const vendor = await VendorProfile.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }
    rfx.invitedVendorIds = Array.from(new Set([...(rfx.invitedVendorIds || []), vendorId]));
    await rfx.save();
    await recordAuditEvent({
      actorId: req.user._id || req.user.id,
      entityType: 'rfx',
      entityId: rfx._id,
      action: 'invite-vendor',
      diff: { vendorId }
    });
    res.json({ rfx });
  } catch (err) {
    next(err);
  }
});

router.get('/:rfxId', requireAuth, async (req, res, next) => {
  try {
    const rfx = await Rfx.findById(req.params.rfxId).lean();
    if (!rfx) {
      return res.status(404).json({ message: 'RFX not found' });
    }
    const hasAccess = req.user.project_roles?.some((role) => role.projectId?.toString() === rfx.projectId.toString());
    if (!hasAccess) {
      return res.status(403).json({ message: 'No project access' });
    }
    res.json({ rfx });
  } catch (err) {
    next(err);
  }
});

router.post('/:projectId/generate', requireAuth, async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { contextIds } = req.body;
    const hasAccess = req.user.project_roles?.some((role) => role.projectId?.toString() === projectId?.toString());
    if (!hasAccess) {
      return res.status(403).json({ message: 'No project access' });
    }
    const generated = await draftRfx(projectId, contextIds || []);
    res.json({ template: generated });
  } catch (err) {
    next(err);
  }
});

export default router;
