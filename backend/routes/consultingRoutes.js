import { Router } from 'express';
import ConsultingSession from '../models/ConsultingSession.js';
import Project from '../models/Project.js';
import { requireAuth } from '../middleware/auth.js';
import { recordAuditEvent } from '../utils/audit.js';
import { structureConsultingNotes } from '../services/openaiService.js';

const router = Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const projectIds = req.query.projectId
      ? [req.query.projectId]
      : (req.user.project_roles || []).map((role) => role.projectId);
    const sessions = await ConsultingSession.find({ projectId: { $in: projectIds } }).lean();
    res.json({ sessions });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { projectId, date, notes } = req.body;
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    const hasAccess = req.user.project_roles?.some((role) => role.projectId?.toString() === projectId?.toString());
    if (!hasAccess) {
      return res.status(403).json({ message: 'No project access' });
    }
    const structured = await structureConsultingNotes(projectId.toString());
    const session = await ConsultingSession.create({
      projectId,
      date,
      notes,
      decisions: structured.decisions || [],
      risks: structured.risks || [],
      actions: structured.actions || []
    });
    await recordAuditEvent({
      actorId: req.user._id || req.user.id,
      entityType: 'consultingSession',
      entityId: session._id,
      action: 'create',
      diff: req.body
    });
    res.status(201).json({ session });
  } catch (err) {
    next(err);
  }
});

export default router;
