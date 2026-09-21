import express from 'express';
const router = express.Router();
import {
    submitCode,
    runCode,
    getUserSubmissions,
    getSubmission
} from '../controller/submissionsController.js';
import authUser from '../middleware/authUser.js';
import { submitLimiter } from '../middleware/rateLimiters.js';

router.post('/submissions', authUser, submitLimiter, submitCode);
router.post('/submissions/run', authUser, submitLimiter, runCode);
router.get('/submissions', authUser, getUserSubmissions);
router.get('/submissions/:id', authUser, getSubmission);

export default router;