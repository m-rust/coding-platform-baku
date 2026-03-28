import express from 'express';
import authRoutes from './routes/auth.js';
import problemRoutes from './routes/problem.js';
import testCaseRoutes from './routes/testcase.js';
import submissionRoutes from './routes/submissions.js';
import userStatsRoutes from './routes/userStats.js';

const app = express();
const port = process.env.PORT || 3000;

// Basic CORS for local frontend on Vite (http://localhost:5173)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.header(
    'Access-Control-Allow-Methods',
    'GET,POST,PUT,PATCH,DELETE,OPTIONS'
  );
  res.header(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

app.use(express.json());

app.get('/', (req, res) => {
  res.send('this is homepage');
});

app.use('/api/auth', authRoutes);
app.use('/api', problemRoutes);
app.use('/api', testCaseRoutes);
app.use('/api', submissionRoutes);
app.use('/api', userStatsRoutes);

app.listen(port, () => {
  console.log(`server is running at port number ${port}`);
});