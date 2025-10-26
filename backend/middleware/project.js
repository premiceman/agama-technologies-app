const mongoose = require('mongoose');
const Project = require('../models/Project');

function requireProjectOwnership(paramName = 'projectId') {
  return async function(req, res, next) {
    try {
      const projectId = req.params[paramName] || req.body?.[paramName] || req.query?.[paramName];
      if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
        return res.status(400).json({ error: 'A valid projectId is required.' });
      }

      const project = await Project.findOne({ _id: projectId, userId: req.auth.uid });
      if (!project) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      req.project = project;
      return next();
    } catch (err) {
      console.error('requireProjectOwnership error', err);
      return res.status(500).json({ error: 'Unable to verify project ownership' });
    }
  };
}

module.exports = { requireProjectOwnership };
