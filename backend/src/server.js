import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.js';
import problemRoutes from './routes/problem.js';
import testCaseRoutes from './routes/testcase.js';
import submissionRoutes from './routes/submissions.js';
import userStatsRoutes from './routes/userStats.js';
import { sweepStalePendingSubmissions } from './controller/submissionsController.js';
import { SUPPORTED_LANGUAGES, LANGUAGES } from './services/codeExecutor.js';

const app = express();
const port = process.env.PORT || 5000;
const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';

app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS) || 0);

app.use(cookieParser());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', allowedOrigin);
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header(
    'Access-Control-Allow-Methods',
    'GET,POST,PUT,PATCH,DELETE,OPTIONS'
  );
  res.header(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization'
  );
  res.header('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

app.use(express.json({ limit: '10mb' }));

app.get('/', (req, res) => {
  res.send('this is homepage');
});

app.get('/api/languages', (req, res) => {
  res.json({
    languages: SUPPORTED_LANGUAGES.map((id) => ({ id, label: LANGUAGES[id].label })),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api', problemRoutes);
app.use('/api', testCaseRoutes);
app.use('/api', submissionRoutes);
app.use('/api', userStatsRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);

  if (res.headersSent) return next(err);

  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body too large' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  res.status(500).json({ error: 'Server error' });
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

app.listen(port, async () => {
  console.log(`server is running at port number ${port}`);

  await sweepStalePendingSubmissions().catch((e) =>
    console.error('Could not sweep stale submissions:', e)
  );
});