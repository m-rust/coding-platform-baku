import prisma from '../../db.js'

import codeExecutor from '../services/codeExecutor.js';

/**
 * Submit code for a problem
 * POST /api/submissions
 */
const submitCode = async (req, res) => {
    try {
        const { problemId, code, language } = req.body;
        const userId = req.user.id;
        
        // ========== VALIDATION ==========
        
        // Check required fields
        if (!problemId || !code || !language) {
            return res.status(400).json({ 
                error: 'Problem ID, code, and language are required' 
            });
        }
        
        // Validate problem ID
        const problemIdInt = parseInt(problemId);
        if (isNaN(problemIdInt)) {
            return res.status(400).json({ error: 'Invalid problem ID' });
        }
        
        // Validate code not empty
        if (code.trim() === '') {
            return res.status(400).json({ error: 'Code cannot be empty' });
        }
        
        // Validate language
        if (!['python', 'cpp'].includes(language)) {
            return res.status(400).json({ 
                error: 'Language must be "python" or "cpp"' 
            });
        }
        
        // ========== GET PROBLEM WITH TEST CASES ==========
        
        const problem = await prisma.problem.findUnique({
            where: { id: problemIdInt },
            include: {
                testCases: {
                    orderBy: { id: 'asc' }
                }
            }
        });
        
        if (!problem) {
            return res.status(404).json({ error: 'Problem not found' });
        }
        
        if (problem.testCases.length === 0) {
            return res.status(400).json({ 
                error: 'Problem has no test cases' 
            });
        }
        
        console.log(`\n=== NEW SUBMISSION ===`);
        console.log(`User: ${req.user.name} (${req.user.email})`);
        console.log(`Problem: ${problem.title}`);
        console.log(`Language: ${language}`);
        console.log(`Test cases: ${problem.testCases.length}`);
        
        // ========== CREATE SUBMISSION RECORD ==========
        
        const submission = await prisma.submission.create({
            data: {
                problemId: problemIdInt,
                userId: userId,
                code: code,
                language: language,
                status: 'pending',
                totalTests: problem.testCases.length
            }
        });
        
        console.log(`Created submission #${submission.id}`);
        
        // ========== RUN CODE AGAINST ALL TEST CASES ==========
        
        let passedCount = 0;
        let overallStatus = 'accepted';
        let totalRuntime = 0;
        const testResults = [];
        
        for (let i = 0; i < problem.testCases.length; i++) {
            const testCase = problem.testCases[i];
            
            console.log(`\nRunning test case ${i + 1}/${problem.testCases.length}...`);
            
            // Execute code
            const result = await codeExecutor.executeCode(
                code,
                testCase.input,
                language,
                5  // 5 second time limit
            );
            
            console.log(`Result: ${result.status}`);
            
            // Check if output matches
            const passed = result.success && 
                          codeExecutor.compareOutputs(result.output, testCase.expectedOutput);
            
            if (passed) {
                passedCount++;
                console.log(`✅ Passed`);
            } else {
                console.log(`❌ Failed`);
                
                // Set overall status to first failure type
                if (overallStatus === 'accepted') {
                    if (result.status === 'time_limit_exceeded') {
                        overallStatus = 'time_limit_exceeded';
                    } else if (result.status === 'compilation_error') {
                        overallStatus = 'compilation_error';
                    } else if (result.status === 'runtime_error') {
                        overallStatus = 'runtime_error';
                    } else if (result.status === 'output_limit_exceeded') {
                        overallStatus = 'output_limit_exceeded';
                    } else {
                        overallStatus = 'wrong_answer';
                    }
                }
            }
            
            // Track total runtime
            if (result.runtime) {
                totalRuntime += result.runtime;
            }
            
            // Store test result
            testResults.push({
                submissionId: submission.id,
                testCaseId: testCase.id,
                passed: passed,
                userOutput: result.output || null,
                expectedOutput: testCase.expectedOutput,
                runtime: result.runtime || null,
                error: result.error || null
            });
        }
        
        console.log(`\nOverall: ${passedCount}/${problem.testCases.length} passed`);
        console.log(`Status: ${overallStatus}`);
        
        // ========== SAVE ALL TEST RESULTS ==========
        
        await prisma.testResult.createMany({
            data: testResults
        });
        
        // ========== UPDATE SUBMISSION WITH FINAL STATUS ==========
        
        const updatedSubmission = await prisma.submission.update({
            where: { id: submission.id },
            data: {
                status: overallStatus,
                passedTests: passedCount,
                runtime: totalRuntime
            },
            include: {
                testResults: {
                    include: {
                        testCase: {
                            select: {
                                id: true,
                                input: true,
                                expectedOutput: true,
                                isHidden: true
                            }
                        }
                    },
                    orderBy: { id: 'asc' }
                }
            }
        });
        
        // ========== UPDATE STATISTICS ==========
        
        const isAccepted = overallStatus === 'accepted';
        
        // Update user stats
        await prisma.user.update({
            where: { id: userId },
            data: {
                totalSubmissions: { increment: 1 },
                acceptedSubmissions: { increment: isAccepted ? 1 : 0 }
            }
        });
        
        // Update problem stats
        const updatedProblem = await prisma.problem.update({
            where: { id: problemIdInt },
            data: {
                totalSubmissions: { increment: 1 },
                acceptedSubmissions: { increment: isAccepted ? 1 : 0 }
            }
        });
        
        // Calculate new acceptance rate
        const newAcceptanceRate = updatedProblem.totalSubmissions > 0
            ? (updatedProblem.acceptedSubmissions / updatedProblem.totalSubmissions) * 100
            : 0;
        
        await prisma.problem.update({
            where: { id: problemIdInt },
            data: {
                acceptanceRate: newAcceptanceRate
            }
        });
        
        // ========== UPDATE/CREATE PROBLEM PROGRESS ==========
        
        // Check if progress record exists
        let progress = await prisma.problemProgress.findUnique({
            where: {
                userId_problemId: {
                    userId: userId,
                    problemId: problemIdInt
                }
            }
        });
        
        if (progress) {
            // Update existing progress
            const wasSolved = progress.status === 'solved';
            const nowSolved = isAccepted;
            
            progress = await prisma.problemProgress.update({
                where: {
                    userId_problemId: {
                        userId: userId,
                        problemId: problemIdInt
                    }
                },
                data: {
                    attempts: { increment: 1 },
                    acceptedSubmissions: { increment: isAccepted ? 1 : 0 },
                    status: wasSolved || nowSolved ? 'solved' : 'attempted',  // ← FIXED!
                    lastAttemptedAt: new Date(),
                    // Only set solvedAt if newly solved
                    solvedAt: nowSolved && !wasSolved ? new Date() : progress.solvedAt,
                    // Update best runtime only if this submission is accepted and faster
                    bestRuntime: isAccepted && totalRuntime > 0
                        ? (progress.bestRuntime ? Math.min(progress.bestRuntime, totalRuntime) : totalRuntime)
                        : progress.bestRuntime
                }
            });
            
            // If this is first accepted submission, increment problemsSolved
            if (isAccepted && !wasSolved) {
                await prisma.user.update({
                    where: { id: userId },
                    data: {
                        problemsSolved: { increment: 1 }
                    }
                });
            }
            
        } else {
            // Create new progress record
            progress = await prisma.problemProgress.create({
                data: {
                    userId: userId,
                    problemId: problemIdInt,
                    attempts: 1,
                    acceptedSubmissions: isAccepted ? 1 : 0,
                    status: isAccepted ? 'solved' : 'attempted',
                    lastAttemptedAt: new Date(),
                    solvedAt: isAccepted ? new Date() : null,
                    bestRuntime: isAccepted ? totalRuntime : null
                }
            });
            
            // If accepted on first try, increment problemsSolved
            if (isAccepted) {
                await prisma.user.update({
                    where: { id: userId },
                    data: {
                        problemsSolved: { increment: 1 }
                    }
                });
            }
        }
        
        console.log(`Updated stats and progress`);
        console.log(`=== SUBMISSION COMPLETE ===\n`);
        
        // ========== PREPARE RESPONSE (PRIVACY FILTERED) ==========
        
        // Filter test results - hide details of hidden test cases that failed
        const filteredResults = updatedSubmission.testResults.map(tr => {
            const isHidden = tr.testCase.isHidden;
            const passed = tr.passed;
            
            return {
                testCaseId: tr.testCaseId,
                passed: passed,
                // Show input/output for public tests or passed hidden tests
                input: !isHidden || passed ? tr.testCase.input : '[Hidden]',
                userOutput: !isHidden || passed ? tr.userOutput : '[Hidden]',
                expectedOutput: !isHidden || passed ? tr.expectedOutput : '[Hidden]',
                runtime: tr.runtime,
                error: !isHidden || passed ? tr.error : 'Failed hidden test case'
            };
        });
        
        // ========== RETURN RESPONSE ==========
        
        return res.status(201).json({
            message: 'Code submitted successfully',
            submission: {
                id: updatedSubmission.id,
                status: updatedSubmission.status,
                passedTests: updatedSubmission.passedTests,
                totalTests: updatedSubmission.totalTests,
                runtime: updatedSubmission.runtime,
                submittedAt: updatedSubmission.submittedAt
            },
            testResults: filteredResults,
            progress: {
                status: progress.status,
                attempts: progress.attempts,
                acceptedSubmissions: progress.acceptedSubmissions,
                bestRuntime: progress.bestRuntime
            }
        });
        
    } catch (error) {
        console.error('Submit code error:', error);
        return res.status(500).json({ 
            error: 'Server error during submission',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get user's own submissions
 * GET /api/submissions?problemId=1&status=accepted&limit=20
 */
const getUserSubmissions = async (req, res) => {
    try {
        const userId = req.user.id;
        const { problemId, status, limit = 20, offset = 0 } = req.query;
        
        // Build filter
        const where = {
            userId: userId
        };
        
        if (problemId) {
            const problemIdInt = parseInt(problemId);
            if (!isNaN(problemIdInt)) {
                where.problemId = problemIdInt;
            }
        }
        
        if (status) {
            where.status = status;
        }
        
        // Get submissions
        const submissions = await prisma.submission.findMany({
            where: where,
            include: {
                problem: {
                    select: {
                        id: true,
                        title: true,
                        difficulty: true
                    }
                }
            },
            orderBy: {
                submittedAt: 'desc'
            },
            take: parseInt(limit),
            skip: parseInt(offset)
        });
        
        // Get total count
        const total = await prisma.submission.count({ where });
        
        return res.status(200).json({
            submissions: submissions.map(s => ({
                id: s.id,
                problemId: s.problemId,
                problemTitle: s.problem.title,
                problemDifficulty: s.problem.difficulty,
                language: s.language,
                status: s.status,
                passedTests: s.passedTests,
                totalTests: s.totalTests,
                runtime: s.runtime,
                submittedAt: s.submittedAt
            })),
            pagination: {
                total: total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: (parseInt(offset) + parseInt(limit)) < total
            }
        });
        
    } catch (error) {
        console.error('Get submissions error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

/**
 * Get single submission (user's own only)
 * GET /api/submissions/:id
 */
const getSubmission = async (req, res) => {
    try {
        const submissionId = parseInt(req.params.id);
        const userId = req.user.id;
        
        if (isNaN(submissionId)) {
            return res.status(400).json({ error: 'Invalid submission ID' });
        }
        
        // Get submission
        const submission = await prisma.submission.findUnique({
            where: { id: submissionId },
            include: {
                problem: {
                    select: {
                        id: true,
                        title: true,
                        difficulty: true,
                        description: true
                    }
                },
                testResults: {
                    include: {
                        testCase: {
                            select: {
                                id: true,
                                input: true,
                                expectedOutput: true,
                                isHidden: true
                            }
                        }
                    },
                    orderBy: { id: 'asc' }
                }
            }
        });
        
        if (!submission) {
            return res.status(404).json({ error: 'Submission not found' });
        }
        
        // Check ownership - users can only see their own submissions
        if (submission.userId !== userId) {
            return res.status(403).json({ 
                error: 'Access denied. You can only view your own submissions.' 
            });
        }
        
        // Filter test results for privacy
        const filteredResults = submission.testResults.map(tr => {
            const isHidden = tr.testCase.isHidden;
            const passed = tr.passed;
            
            return {
                testCaseId: tr.testCaseId,
                passed: passed,
                input: !isHidden || passed ? tr.testCase.input : '[Hidden]',
                userOutput: !isHidden || passed ? tr.userOutput : '[Hidden]',
                expectedOutput: !isHidden || passed ? tr.expectedOutput : '[Hidden]',
                runtime: tr.runtime,
                error: !isHidden || passed ? tr.error : 'Failed hidden test case'
            };
        });
        
        return res.status(200).json({
            submission: {
                id: submission.id,
                problemId: submission.problemId,
                problemTitle: submission.problem.title,
                problemDifficulty: submission.problem.difficulty,
                code: submission.code,
                language: submission.language,
                status: submission.status,
                passedTests: submission.passedTests,
                totalTests: submission.totalTests,
                runtime: submission.runtime,
                submittedAt: submission.submittedAt
            },
            testResults: filteredResults
        });
        
    } catch (error) {
        console.error('Get submission error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

export {
    submitCode,
    getUserSubmissions,
    getSubmission
};