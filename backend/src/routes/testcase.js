import express from 'express';
import {createTestCase, updateTestCase, getTestCase, deleteTestCase, getTestCases} from '../controller/testCasesController.js';
import authUser from '../middleware/authUser.js';
import checkProblemOwner from '../middleware/checkProblemOwner.js'

const router = express.Router();

// Get all test cases for a problem (including hidden ones - owner/admin only)
// GET    /api/problems/:id/testcases

// Add new test case to problem
// POST   /api/problems/:id/testcases

// Update specific test case
// PUT    /api/problems/:id/testcases/:tcId

// Delete specific test case
// DELETE /api/problems/:id/testcases/:tcId

router.post('/problems/:id/testcases', authUser, checkProblemOwner, createTestCase);
router.patch('/problems/:id/testcases/:tcId', authUser, checkProblemOwner, updateTestCase);
router.delete('/problems/:id/testcases/:tcId', authUser, checkProblemOwner, deleteTestCase);
router.get('/problems/:id/testcases/:tcId', authUser, getTestCase);
router.get('/problems/:id/testcases', authUser, getTestCases);

export default router;