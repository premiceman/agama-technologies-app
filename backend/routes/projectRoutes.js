import { Router } from 'express';
import Project from '../models/Project.js';
import Organisation from '../models/Organisation.js';
import { requireAuth } from '../middleware/auth.js';
import { recordAuditEvent } from '../utils/audit.js';
import User from '../models/User.js';

const router = Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const accessibleOrgIds = (req.user.org_roles || []).map(
      (role) => role.orgId
    );
    const accessibleProjectIds = (req.user.project_roles || []).map(
      (role) => role.projectId
    );
    const projects = await Project.find({
      $or: [
        { orgId: { $in: accessibleOrgIds } },
        { _id: { $in: accessibleProjectIds } }
      ]
    }).lean();
    res.json({ projects });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { orgId } = req.body;
    const hasOrgAccess = req.user.org_roles?.some(
      (role) => role.orgId?.toString() === orgId?.toString()
    );
    if (!hasOrgAccess) {
      return res.status(403).json({ message: 'No organisation access' });
    }
    const organisation = await Organisation.findById(orgId);
    if (!organisation) {
      return res.status(404).json({ message: 'Organisation not found' });
    }
    const project = await Project.create({
      ...req.body,
      createdBy: req.user._id || req.user.id
    });
    await User.findByIdAndUpdate(req.user._id || req.user.id, {
      $addToSet: { project_roles: { projectId: project._id, role: 'admin' } }
    });
    await recordAuditEvent({
      actorId: req.user._id || req.user.id,
      entityType: 'project',
      entityId: project._id,
      action: 'create',
      diff: req.body
    });
    res.status(201).json({ project });
  } catch (err) {
    next(err);
  }
});

router.get('/:projectId', requireAuth, async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.projectId).lean();
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    const hasAccess =
      req.user.project_roles?.some(
        (role) => role.projectId?.toString() === project._id.toString()
      ) ||
      req.user.org_roles?.some(
        (role) => role.orgId?.toString() === project.orgId?.toString()
      );
    if (!hasAccess) {
      return res.status(403).json({ message: 'No project access' });
    }
    res.json({ project });
  } catch (err) {
    next(err);
  }
});

router.put('/:projectId', requireAuth, async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    const hasAccess = req.user.project_roles?.some(
      (role) => role.projectId?.toString() === project._id.toString()
    );
    if (!hasAccess) {
      return res.status(403).json({ message: 'No project access' });
    }
    Object.assign(project, req.body);
    await project.save();
    await recordAuditEvent({
      actorId: req.user._id || req.user.id,
      entityType: 'project',
      entityId: project._id,
      action: 'update',
      diff: req.body
    });
    res.json({ project });
  } catch (err) {
    next(err);
  }
});

router.delete('/:projectId', requireAuth, async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    const hasAccess = req.user.project_roles?.some(
      (role) => role.projectId?.toString() === project._id.toString()
    );
    if (!hasAccess) {
      return res.status(403).json({ message: 'No project access' });
    }
    await Project.findByIdAndDelete(project._id);
    await recordAuditEvent({
      actorId: req.user._id || req.user.id,
      entityType: 'project',
      entityId: project._id,
      action: 'delete',
      diff: {}
    });
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
