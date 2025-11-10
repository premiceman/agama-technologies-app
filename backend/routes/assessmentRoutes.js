import { Router } from 'express';
import Assessment from '../models/Assessment.js';
import Project from '../models/Project.js';
import MaturityModel from '../models/MaturityModel.js';
import { requireAuth } from '../middleware/auth.js';
import { recordAuditEvent } from '../utils/audit.js';
import { scoreAssessment } from '../utils/scoring.js';

const router = Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const projectIds = (req.user.project_roles || []).map((role) => role.projectId);
    const assessments = await Assessment.find({ projectId: { $in: projectIds } }).lean();
    res.json({ assessments });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { projectId, type, modelVersion, responses } = req.body;
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    const hasAccess = req.user.project_roles?.some((role) => role.projectId?.toString() === projectId?.toString());
    if (!hasAccess) {
      return res.status(403).json({ message: 'No project access' });
    }
    const model = await MaturityModel.findOne({ type, version: modelVersion });
    const scores = model ? scoreAssessment(model, responses) : { bySection: {}, overall: 0 };
    const assessment = await Assessment.create({
      projectId,
      type,
      modelVersion,
      responses,
      scores,
      createdBy: req.user._id || req.user.id
    });
    await recordAuditEvent({
      actorId: req.user._id || req.user.id,
      entityType: 'assessment',
      entityId: assessment._id,
      action: 'create',
      diff: req.body
    });
    res.status(201).json({ assessment });
  } catch (err) {
    next(err);
  }
});

router.get('/:assessmentId', requireAuth, async (req, res, next) => {
  try {
    const assessment = await Assessment.findById(req.params.assessmentId).lean();
    if (!assessment) {
      return res.status(404).json({ message: 'Assessment not found' });
    }
    const project = await Project.findById(assessment.projectId);
    const hasAccess = req.user.project_roles?.some(
      (role) => role.projectId?.toString() === project._id.toString()
    );
    if (!hasAccess) {
      return res.status(403).json({ message: 'No project access' });
    }
    res.json({ assessment });
  } catch (err) {
    next(err);
  }
});

router.post('/:assessmentId/score', requireAuth, async (req, res, next) => {
  try {
    const assessment = await Assessment.findById(req.params.assessmentId);
    if (!assessment) {
      return res.status(404).json({ message: 'Assessment not found' });
    }
    const hasAccess = req.user.project_roles?.some(
      (role) => role.projectId?.toString() === assessment.projectId.toString()
    );
    if (!hasAccess) {
      return res.status(403).json({ message: 'No project access' });
    }
    const model = await MaturityModel.findOne({ type: assessment.type, version: assessment.modelVersion });
    assessment.scores = model ? scoreAssessment(model, assessment.responses) : assessment.scores;
    await assessment.save();
    res.json({ scores: assessment.scores });
  } catch (err) {
    next(err);
  }
});

export default router;
