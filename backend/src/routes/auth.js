import express from 'express';
import { register, login, refreshAccessToken, logout, getCurrentUser } from '../controller/userController.js';
import authUser from '../middleware/authUser.js';
import { authLimiter } from '../middleware/rateLimiters.js';

const router = express.Router();

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/refresh', authLimiter, refreshAccessToken);
router.post('/logout', logout);
router.get('/me', authUser, getCurrentUser);

export default router;