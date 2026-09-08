import express from 'express';
const router = express.Router();
import {
    submitCode,
    getUserSubmissions,
    getSubmission
} from '../controller/submissionsController.js';
import authUser from '../middleware/authUser.js';
import { submitLimiter } from '../middleware/rateLimiters.js';

router.post('/submissions', authUser, submitLimiter, submitCode);
router.get('/submissions', authUser, getUserSubmissions);
router.get('/submissions/:id', authUser, getSubmission);

export default router;