import { Router } from 'express';
import Roadmap from '../models/Roadmap.js';
import Project from '../models/Project.js';
import { requireAuth } from '../middleware/auth.js';
import { recordAuditEvent } from '../utils/audit.js';
import { composeRoadmap } from '../services/openaiService.js';

const router = Router();

router.get('/project/:projectId', requireAuth, async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const hasAccess = req.user.project_roles?.some((role) => role.projectId?.toString() === projectId?.toString());
    if (!hasAccess) {
      return res.status(403).json({ message: 'No project access' });
    }
    const roadmap = await Roadmap.findOne({ projectId }).lean();
    res.json({ roadmap });
  } catch (err) {
    next(err);
  }
});

router.post('/create-from-assessments', requireAuth, async (req, res, next) => {
  try {
    const { projectId, targets } = req.body;
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    const hasAccess = req.user.project_roles?.some((role) => role.projectId?.toString() === projectId?.toString());
    if (!hasAccess) {
      return res.status(403).json({ message: 'No project access' });
    }
    const drafted = req.body.initiatives
      ? { initiatives: req.body.initiatives }
      : await composeRoadmap(projectId.toString(), targets || {});
    const roadmap = await Roadmap.findOneAndUpdate(
      { projectId },
      { projectId, initiatives: drafted.initiatives || [] },
      { upsert: true, new: true }
    );
    await recordAuditEvent({
      actorId: req.user._id || req.user.id,
      entityType: 'roadmap',
      entityId: roadmap._id,
      action: 'generate',
      diff: { targets }
    });
    res.status(201).json({ roadmap });
  } catch (err) {
    next(err);
  }
});

router.put('/:roadmapId', requireAuth, async (req, res, next) => {
  try {
    const roadmap = await Roadmap.findById(req.params.roadmapId);
    if (!roadmap) {
      return res.status(404).json({ message: 'Roadmap not found' });
    }
    const hasAccess = req.user.project_roles?.some((role) => role.projectId?.toString() === roadmap.projectId.toString());
    if (!hasAccess) {
      return res.status(403).json({ message: 'No project access' });
    }
    Object.assign(roadmap, req.body);
    await roadmap.save();
    await recordAuditEvent({
      actorId: req.user._id || req.user.id,
      entityType: 'roadmap',
      entityId: roadmap._id,
      action: 'update',
      diff: req.body
    });
    res.json({ roadmap });
  } catch (err) {
    next(err);
  }
});

export default router;
