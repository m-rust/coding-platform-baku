import express from 'express';
const router = express.Router();
import {
    submitCode,
    getUserSubmissions,
    getSubmission
} from '../controller/submissionsController.js';
import authUser from '../middleware/authUser.js';

// All submission routes require authentication
router.post('/submissions', authUser, submitCode);
router.get('/submissions', authUser, getUserSubmissions);
router.get('/submissions/:id', authUser, getSubmission);

export default router;