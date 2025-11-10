import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  generateAssessmentModel,
  draftRfx,
  autoscoreVendorResponse,
  composeComparisonNarrative,
  composeRoadmap,
  structureConsultingNotes
} from '../services/openaiService.js';

const router = Router();

router.post('/assessments/model', requireAuth, async (req, res, next) => {
  try {
    const { industry, size, domains } = req.body;
    const schema = await generateAssessmentModel(industry, size, domains || []);
    res.json({ schema });
  } catch (err) {
    next(err);
  }
});

router.post('/rfx/draft', requireAuth, async (req, res, next) => {
  try {
    const { projectId, contextIds } = req.body;
    const draft = await draftRfx(projectId, contextIds || []);
    res.json({ draft });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/vendor-responses/:responseId/autoscore',
  requireAuth,
  async (req, res, next) => {
    try {
      const { rfxId } = req.body;
      const scores = await autoscoreVendorResponse(
        rfxId,
        req.params.responseId
      );
      res.json({ scores });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/comparisons/:comparisonId/narrative',
  requireAuth,
  async (req, res, next) => {
    try {
      const { rfxId } = req.body;
      const narrative = await composeComparisonNarrative(
        rfxId,
        req.params.comparisonId
      );
      res.json({ narrative });
    } catch (err) {
      next(err);
    }
  }
);

router.post('/roadmaps/compose', requireAuth, async (req, res, next) => {
  try {
    const { projectId, targets } = req.body;
    const roadmap = await composeRoadmap(projectId, targets || {});
    res.json({ roadmap });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/consulting/:sessionId/structure',
  requireAuth,
  async (req, res, next) => {
    try {
      const structured = await structureConsultingNotes(req.params.sessionId);
      res.json({ structured });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
