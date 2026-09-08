import express from 'express';
import { createProblem, getProblem, getAllProblems, updateProblem, deleteProblem, getAllTags } from '../controller/problemController.js';
import { extractProblemFromImageController } from '../controller/ImageConversion.js';
import authProblem from '../middleware/authProblem.js';
import authUser from '../middleware/authUser.js';
import checkProblemOwner from '../middleware/checkProblemOwner.js'
import optionalAuth from '../middleware/optionalAuthMiddleware.js';
import { imageLimiter } from '../middleware/rateLimiters.js';

const router = express.Router();

router.post('/problems/extract-from-image', authUser, imageLimiter, extractProblemFromImageController);
router.post('/problems', authUser, authProblem, createProblem);
router.patch('/problems/:id', authUser, checkProblemOwner, updateProblem);
router.delete('/problems/:id', authUser, checkProblemOwner, deleteProblem);
router.get('/problems/tags/list', getAllTags);
router.get('/problems/:id', optionalAuth, getProblem);
router.get('/problems', optionalAuth, getAllProblems);

export default router;