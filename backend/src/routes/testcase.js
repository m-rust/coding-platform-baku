import express from 'express';
import {createTestCase, updateTestCase, getTestCase, deleteTestCase, getTestCases} from '../controller/testCasesController.js';
import authUser from '../middleware/authUser.js';
import checkProblemOwner from '../middleware/checkProblemOwner.js'

const router = express.Router();

router.post('/problems/:id/testcases', authUser, checkProblemOwner, createTestCase);
router.patch('/problems/:id/testcases/:tcId', authUser, checkProblemOwner, updateTestCase);
router.delete('/problems/:id/testcases/:tcId', authUser, checkProblemOwner, deleteTestCase);
router.get('/problems/:id/testcases/:tcId', authUser, getTestCase);
router.get('/problems/:id/testcases', authUser, getTestCases);

export default router;