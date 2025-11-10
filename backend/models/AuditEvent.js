import mongoose from 'mongoose';

const AuditEventSchema = new mongoose.Schema(
  {
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    ts: { type: Date, default: Date.now },
    entity: {
      type: new mongoose.Schema(
        {
          type: { type: String, required: true },
          id: { type: mongoose.Schema.Types.ObjectId, required: true }
        },
        { _id: false }
      ),
      required: true
    },
    action: { type: String, required: true },
    diff: { type: mongoose.Schema.Types.Mixed }
  },
  { timestamps: true }
);

export default mongoose.model('AuditEvent', AuditEventSchema);
