const mongoose = require('mongoose');

const { Schema } = mongoose;

const SearchIndexEntrySchema = new Schema(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', index: true, required: true },
    entityType: { type: String, required: true, index: true },
    entityId: { type: Schema.Types.ObjectId, required: true },
    roomId: { type: Schema.Types.ObjectId, ref: 'EngagementRoom', index: true },
    suite: { type: String, enum: ['vendor', 'buyer', 'shared'], required: true },
    visibility: { type: String, enum: ['vendor_only', 'buyer_only', 'shared'], default: 'shared', index: true },
    title: { type: String, required: true, trim: true },
    snippet: { type: String, trim: true },
    payload: { type: Schema.Types.Mixed, default: {} },
    ownerIds: { type: [Schema.Types.ObjectId], default: [] },
    participantIds: { type: [Schema.Types.ObjectId], default: [] },
    tags: { type: [String], default: [] },
    updatedAt: { type: Date, default: Date.now }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

SearchIndexEntrySchema.index({ orgId: 1, entityType: 1, entityId: 1, visibility: 1 }, { unique: true });
SearchIndexEntrySchema.index({ orgId: 1, entityType: 1, visibility: 1 });
SearchIndexEntrySchema.index({ suite: 1, visibility: 1 });
SearchIndexEntrySchema.index({ participantIds: 1 });
SearchIndexEntrySchema.index({ title: 'text', snippet: 'text', 'payload.text': 'text' });

module.exports = mongoose.model('SearchIndexEntry', SearchIndexEntrySchema);
