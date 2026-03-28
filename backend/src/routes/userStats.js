import express from 'express';
const router = express.Router();
import {
    getUserStats,
    getAllProgress,
    getProblemProgress
} from '../controller/userStatsController.js';
import authUser from '../middleware/authUser.js';

// All routes require authentication
router.get('/users/me/stats', authUser, getUserStats);
router.get('/users/me/progress', authUser, getAllProgress);
router.get('/users/me/progress/:problemId', authUser, getProblemProgress);

export default router;