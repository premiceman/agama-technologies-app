import mongoose from 'mongoose';

const InitiativeSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String },
    owner: { type: String },
    start: { type: Date },
    end: { type: Date },
    deps: [{ type: String }],
    risk: { type: String },
    kpis: [{ type: String }]
  },
  { _id: false }
);

const RoadmapSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    initiatives: [InitiativeSchema]
  },
  { timestamps: true }
);

export default mongoose.model('Roadmap', RoadmapSchema);
