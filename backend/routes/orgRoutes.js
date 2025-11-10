import { Router } from 'express';
import Organisation from '../models/Organisation.js';
import BusinessUnit from '../models/BusinessUnit.js';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { recordAuditEvent } from '../utils/audit.js';

const router = Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const orgIds = (req.user.org_roles || []).map((role) => role.orgId);
    const organisations = await Organisation.find({ _id: { $in: orgIds } });
    res.json({ organisations });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const organisation = await Organisation.create(req.body);
    await User.findByIdAndUpdate(req.user._id || req.user.id, {
      $push: { org_roles: { orgId: organisation._id, role: 'owner' } }
    });
    await recordAuditEvent({
      actorId: req.user._id || req.user.id,
      entityType: 'organisation',
      entityId: organisation._id,
      action: 'create',
      diff: req.body
    });
    res.status(201).json({ organisation });
  } catch (err) {
    next(err);
  }
});

router.get('/:orgId', requireAuth, async (req, res, next) => {
  try {
    const organisation = await Organisation.findById(req.params.orgId);
    if (!organisation) {
      return res.status(404).json({ message: 'Organisation not found' });
    }
    const hasAccess = req.user.org_roles?.some((role) => role.orgId?.toString() === organisation._id.toString());
    if (!hasAccess) {
      return res.status(403).json({ message: 'No organisation access' });
    }
    res.json({ organisation });
  } catch (err) {
    next(err);
  }
});

router.put('/:orgId', requireAuth, async (req, res, next) => {
  try {
    const hasAccess = req.user.org_roles?.some((role) => role.orgId?.toString() === req.params.orgId);
    if (!hasAccess) {
      return res.status(403).json({ message: 'No organisation access' });
    }
    const organisation = await Organisation.findByIdAndUpdate(req.params.orgId, req.body, { new: true });
    if (!organisation) {
      return res.status(404).json({ message: 'Organisation not found' });
    }
    await recordAuditEvent({
      actorId: req.user._id || req.user.id,
      entityType: 'organisation',
      entityId: organisation._id,
      action: 'update',
      diff: req.body
    });
    res.json({ organisation });
  } catch (err) {
    next(err);
  }
});

router.delete('/:orgId', requireAuth, async (req, res, next) => {
  try {
    const hasAccess = req.user.org_roles?.some((role) => role.orgId?.toString() === req.params.orgId);
    if (!hasAccess) {
      return res.status(403).json({ message: 'No organisation access' });
    }
    const organisation = await Organisation.findByIdAndDelete(req.params.orgId);
    if (!organisation) {
      return res.status(404).json({ message: 'Organisation not found' });
    }
    await recordAuditEvent({
      actorId: req.user._id || req.user.id,
      entityType: 'organisation',
      entityId: organisation._id,
      action: 'delete',
      diff: {}
    });
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
});

router.get('/:orgId/bus', requireAuth, async (req, res, next) => {
  try {
    const hasAccess = req.user.org_roles?.some((role) => role.orgId?.toString() === req.params.orgId);
    if (!hasAccess) {
      return res.status(403).json({ message: 'No organisation access' });
    }
    const units = await BusinessUnit.find({ orgId: req.params.orgId });
    res.json({ businessUnits: units });
  } catch (err) {
    next(err);
  }
});

router.post('/:orgId/bus', requireAuth, async (req, res, next) => {
  try {
    const hasAccess = req.user.org_roles?.some((role) => role.orgId?.toString() === req.params.orgId);
    if (!hasAccess) {
      return res.status(403).json({ message: 'No organisation access' });
    }
    const unit = await BusinessUnit.create({ orgId: req.params.orgId, ...req.body });
    await recordAuditEvent({
      actorId: req.user._id || req.user.id,
      entityType: 'businessUnit',
      entityId: unit._id,
      action: 'create',
      diff: req.body
    });
    res.status(201).json({ businessUnit: unit });
  } catch (err) {
    next(err);
  }
});

router.put('/:orgId/bus/:buId', requireAuth, async (req, res, next) => {
  try {
    const hasAccess = req.user.org_roles?.some((role) => role.orgId?.toString() === req.params.orgId);
    if (!hasAccess) {
      return res.status(403).json({ message: 'No organisation access' });
    }
    const unit = await BusinessUnit.findByIdAndUpdate(req.params.buId, req.body, { new: true });
    if (!unit) {
      return res.status(404).json({ message: 'Business unit not found' });
    }
    await recordAuditEvent({
      actorId: req.user._id || req.user.id,
      entityType: 'businessUnit',
      entityId: unit._id,
      action: 'update',
      diff: req.body
    });
    res.json({ businessUnit: unit });
  } catch (err) {
    next(err);
  }
});

router.delete('/:orgId/bus/:buId', requireAuth, async (req, res, next) => {
  try {
    const hasAccess = req.user.org_roles?.some((role) => role.orgId?.toString() === req.params.orgId);
    if (!hasAccess) {
      return res.status(403).json({ message: 'No organisation access' });
    }
    const unit = await BusinessUnit.findByIdAndDelete(req.params.buId);
    if (!unit) {
      return res.status(404).json({ message: 'Business unit not found' });
    }
    await recordAuditEvent({
      actorId: req.user._id || req.user.id,
      entityType: 'businessUnit',
      entityId: unit._id,
      action: 'delete',
      diff: {}
    });
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
