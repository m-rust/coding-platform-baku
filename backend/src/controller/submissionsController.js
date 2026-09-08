import prisma from '../../db.js'

import codeExecutor, { SUPPORTED_LANGUAGES } from '../services/codeExecutor.js';
import { isSaturated, tryClaimUser, releaseUser } from '../services/judgeQueue.js';

const submitCode = async (req, res) => {
    const userId = req.user.id;
    let claimed = false;

    try {
        const { problemId, code, language } = req.body;

        if (!problemId || !code || !language) {
            return res.status(400).json({
                error: 'Problem ID, code, and language are required'
            });
        }

        const problemIdInt = parseInt(problemId);
        if (isNaN(problemIdInt)) {
            return res.status(400).json({ error: 'Invalid problem ID' });
        }

        if (code.trim() === '') {
            return res.status(400).json({ error: 'Code cannot be empty' });
        }

        if (!SUPPORTED_LANGUAGES.includes(language)) {
            return res.status(400).json({
                error: `Language must be one of: ${SUPPORTED_LANGUAGES.join(', ')}`
            });
        }

        const problem = await prisma.problem.findUnique({
            where: { id: problemIdInt },
            include: { testCases: { orderBy: { id: 'asc' } } }
        });

        if (!problem) {
            return res.status(404).json({ error: 'Problem not found' });
        }

        if (problem.testCases.length === 0) {
            return res.status(400).json({ error: 'Problem has no test cases' });
        }

        if (isSaturated()) {
            return res.status(503).json({
                error: 'Judge is busy. Please try again in a moment.'
            });
        }

        if (!tryClaimUser(userId)) {
            return res.status(409).json({
                error: 'You already have a submission in progress.'
            });
        }

        claimed = true;

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

        console.log(`Created submission #${submission.id} (${problem.title}, ${language})`);

        judgeSubmission({ submission, problem, code, language, userId })
            .catch((error) => console.error('Judge run failed:', error))
            .finally(() => releaseUser(userId));

        claimed = false;

        return res.status(202).json({
            message: 'Submission queued',
            submission: {
                id: submission.id,
                status: submission.status,
                totalTests: submission.totalTests,
                submittedAt: submission.submittedAt
            }
        });

    } catch (error) {
        console.error('Submit code error:', error);
        return res.status(500).json({ error: 'Server error during submission' });
    } finally {
        if (claimed) releaseUser(userId);
    }
};

const judgeSubmission = async ({ submission, problem, code, language, userId }) => {
    try {
        const testCases = problem.testCases;

        const results = await codeExecutor.executeBatch(
            code,
            testCases.map(tc => tc.input),
            language,
            5
        );

        let passedCount = 0;
        let overallStatus = 'accepted';
        let totalRuntime = 0;
        const testResults = [];

        for (let i = 0; i < testCases.length; i++) {
            const testCase = testCases[i];
            const result = results[i];

            const passed = result.success &&
                codeExecutor.compareOutputs(result.output, testCase.expectedOutput);

            if (passed) {
                passedCount++;
            } else if (overallStatus === 'accepted') {
                overallStatus = result.status === 'success' ? 'wrong_answer' : result.status;
            }

            if (result.runtime) totalRuntime += result.runtime;

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

        console.log(`Submission #${submission.id}: ${overallStatus} (${passedCount}/${testCases.length})`);

        await persistOutcome({
            submission,
            problemId: problem.id,
            userId,
            overallStatus,
            passedCount,
            totalRuntime,
            testResults
        });

    } catch (error) {
        console.error(`Submission #${submission.id} failed:`, error);

        await prisma.submission
            .update({
                where: { id: submission.id },
                data: { status: 'internal_error' }
            })
            .catch((e) => console.error('Could not mark submission failed:', e));
    }
};

const persistOutcome = async ({
    submission, problemId, userId, overallStatus, passedCount, totalRuntime, testResults
}) => {
    const isAccepted = overallStatus === 'accepted';

    await prisma.$transaction(async (tx) => {
        await tx.testResult.createMany({ data: testResults });

        await tx.submission.update({
            where: { id: submission.id },
            data: {
                status: overallStatus,
                passedTests: passedCount,
                runtime: totalRuntime
            }
        });

        await tx.user.update({
            where: { id: userId },
            data: {
                totalSubmissions: { increment: 1 },
                acceptedSubmissions: { increment: isAccepted ? 1 : 0 }
            }
        });

        const updatedProblem = await tx.problem.update({
            where: { id: problemId },
            data: {
                totalSubmissions: { increment: 1 },
                acceptedSubmissions: { increment: isAccepted ? 1 : 0 }
            }
        });

        await tx.problem.update({
            where: { id: problemId },
            data: {
                acceptanceRate: updatedProblem.totalSubmissions > 0
                    ? (updatedProblem.acceptedSubmissions / updatedProblem.totalSubmissions) * 100
                    : 0
            }
        });

        const key = { userId_problemId: { userId: userId, problemId: problemId } };
        const existing = await tx.problemProgress.findUnique({ where: key });
        const wasSolved = existing?.status === 'solved';

        await tx.problemProgress.upsert({
            where: key,
            create: {
                userId: userId,
                problemId: problemId,
                attempts: 1,
                acceptedSubmissions: isAccepted ? 1 : 0,
                status: isAccepted ? 'solved' : 'attempted',
                lastAttemptedAt: new Date(),
                solvedAt: isAccepted ? new Date() : null,
                bestRuntime: isAccepted ? totalRuntime : null
            },
            update: {
                attempts: { increment: 1 },
                acceptedSubmissions: { increment: isAccepted ? 1 : 0 },
                status: wasSolved || isAccepted ? 'solved' : 'attempted',
                lastAttemptedAt: new Date(),
                solvedAt: isAccepted && !wasSolved ? new Date() : existing?.solvedAt,
                bestRuntime: isAccepted && totalRuntime > 0
                    ? (existing?.bestRuntime
                        ? Math.min(existing.bestRuntime, totalRuntime)
                        : totalRuntime)
                    : existing?.bestRuntime
            }
        });

        if (isAccepted && !wasSolved) {
            await tx.user.update({
                where: { id: userId },
                data: { problemsSolved: { increment: 1 } }
            });
        }
    }, { timeout: 15000 });
};

const sweepStalePendingSubmissions = async () => {
    const { count } = await prisma.submission.updateMany({
        where: { status: 'pending' },
        data: { status: 'internal_error' }
    });

    if (count > 0) {
        console.log(`Marked ${count} abandoned pending submission(s) as internal_error`);
    }
};

const getUserSubmissions = async (req, res) => {
    try {
        const userId = req.user.id;
        const { problemId, status, limit = 20, offset = 0 } = req.query;
        
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

const getSubmission = async (req, res) => {
    try {
        const submissionId = parseInt(req.params.id);
        const userId = req.user.id;
        
        if (isNaN(submissionId)) {
            return res.status(400).json({ error: 'Invalid submission ID' });
        }
        
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
        
        if (submission.userId !== userId) {
            return res.status(403).json({ 
                error: 'Access denied. You can only view your own submissions.' 
            });
        }
        
        const filteredResults = submission.testResults.map(tr => {
            const isHidden = tr.testCase.isHidden;
            const passed = tr.passed;
            
            return {
                testCaseId: tr.testCaseId,
                passed: passed,
                input: isHidden ? '[Hidden]' : tr.testCase.input,
                userOutput: isHidden ? '[Hidden]' : tr.userOutput,
                expectedOutput: isHidden ? '[Hidden]' : tr.expectedOutput,
                runtime: tr.runtime,
                error: isHidden ? (passed ? null : 'Failed hidden test case') : tr.error
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
    getSubmission,
    sweepStalePendingSubmissions
};