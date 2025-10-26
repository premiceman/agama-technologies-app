const mongoose = require('mongoose');
const { Schema } = mongoose;

const FileSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', index: true, required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', index: true, required: true },
    storageId: { type: Schema.Types.ObjectId, required: true, unique: true },
    filename: { type: String, required: true },
    length: { type: Number, required: true },
    chunkSize: { type: Number, required: true },
    uploadDate: { type: Date, required: true },
    md5: { type: String },
    mime: { type: String, required: true },
    status: { type: String, enum: ['clean', 'quarantined', 'pending'], default: 'pending', index: true },
    openaiFileId: { type: String },
    openaiVectorStoreId: { type: String },
    indexedAt: { type: Date },
    quarantineReason: { type: String }
  },
  { timestamps: true }
);

FileSchema.methods.toJSON = function toJSON() {
  return {
    id: this._id,
    projectId: this.projectId,
    ownerId: this.ownerId,
    filename: this.filename,
    length: this.length,
    chunkSize: this.chunkSize,
    uploadDate: this.uploadDate,
    md5: this.md5,
    mime: this.mime,
    status: this.status,
    openaiFileId: this.openaiFileId || null,
    openaiVectorStoreId: this.openaiVectorStoreId || null,
    indexedAt: this.indexedAt || null,
    quarantineReason: this.quarantineReason || null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

module.exports = mongoose.model('File', FileSchema);
