import AuditEvent from '../models/AuditEvent.js';

export const recordAuditEvent = async ({
  actorId,
  entityType,
  entityId,
  action,
  diff
}) => {
  try {
    await AuditEvent.create({
      actorId,
      entity: { type: entityType, id: entityId },
      action,
      diff
    });
  } catch (err) {
    console.error('Failed to record audit event', err);
  }
};
