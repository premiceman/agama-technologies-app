import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import MaturityModel from '../models/MaturityModel.js';

const router = Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const models = await MaturityModel.find({}).lean();
    res.json({ models });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const model = await MaturityModel.findById(req.params.id).lean();
    if (!model) {
      return res.status(404).json({ message: 'Model not found' });
    }
    res.json({ model });
  } catch (err) {
    next(err);
  }
});

export default router;
