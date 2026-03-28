import express from 'express';
import { register, login, refreshAccessToken, logout, getCurrentUser } from '../controller/userController.js';
import authUser from '../middleware/authUser.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refreshAccessToken);
router.post('/logout', logout);
router.get('/me', authUser, getCurrentUser);

export default router;