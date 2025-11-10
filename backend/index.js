import express from 'express';
import mongoose from 'mongoose';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import dotenv from 'dotenv';
import morgan from 'morgan';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/authRoutes.js';
import orgRoutes from './routes/orgRoutes.js';
import projectRoutes from './routes/projectRoutes.js';
import maturityModelRoutes from './routes/maturityModelRoutes.js';
import assessmentRoutes from './routes/assessmentRoutes.js';
import rfxRoutes from './routes/rfxRoutes.js';
import vendorResponseRoutes from './routes/vendorResponseRoutes.js';
import comparisonRoutes from './routes/comparisonRoutes.js';
import roadmapRoutes from './routes/roadmapRoutes.js';
import consultingRoutes from './routes/consultingRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import { resolveUser } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/agama';
const SESSION_SECRET = process.env.SESSION_SECRET || 'agama-dev-secret';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

mongoose
  .connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('Mongo connection error', err));

app.use(
  cors({
    origin: true,
    credentials: true
  })
);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: MONGO_URI }),
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: false
    }
  })
);

app.use(resolveUser);

app.use('/api/auth', authRoutes);
app.use('/api/orgs', orgRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/maturity-models', maturityModelRoutes);
app.use('/api/assessments', assessmentRoutes);
app.use('/api/rfx', rfxRoutes);
app.use('/api/vendor-responses', vendorResponseRoutes);
app.use('/api/comparisons', comparisonRoutes);
app.use('/api/roadmaps', roadmapRoutes);
app.use('/api/consulting-sessions', consultingRoutes);
app.use('/api/ai', aiRoutes);

app.use(errorHandler);

app.use(express.static(path.join(__dirname, '../client')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
