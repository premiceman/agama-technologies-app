const { ZodError } = require('zod');

function formatZodError(err) {
  if (!(err instanceof ZodError)) return 'Invalid request payload';
  return err.errors.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ');
}

function validateBody(schema) {
  return function(req, res, next) {
    try {
      const result = schema.parse(req.body ?? {});
      req.validatedBody = result;
      return next();
    } catch (err) {
      const message = formatZodError(err);
      return res.status(400).json({ error: message });
    }
  };
}

module.exports = { validateBody };
