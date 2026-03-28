import prisma from '../../db.js';

/**
 * Get current user's overall statistics
 * GET /api/users/me/stats
 */
const getUserStats = async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Get user with basic stats
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                email: true,
                totalSubmissions: true,
                acceptedSubmissions: true,
                problemsSolved: true,
                createdAt: true
            }
        });
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Calculate acceptance rate
        const acceptanceRate = user.totalSubmissions > 0
            ? ((user.acceptedSubmissions / user.totalSubmissions) * 100).toFixed(1)
            : 0;
        
        // Get problems solved by difficulty
        const problemProgress = await prisma.problemProgress.findMany({
            where: {
                userId: userId,
                status: 'solved'
            },
            include: {
                problem: {
                    select: {
                        difficulty: true
                    }
                }
            }
        });
        
        // Count by difficulty
        const byDifficulty = {
            easy: 0,
            medium: 0,
            hard: 0
        };
        
        problemProgress.forEach(progress => {
            const difficulty = progress.problem.difficulty.toLowerCase();
            if (byDifficulty.hasOwnProperty(difficulty)) {
                byDifficulty[difficulty]++;
            }
        });
        
        // Get recent submissions (last 10)
        const recentSubmissions = await prisma.submission.findMany({
            where: { userId: userId },
            include: {
                problem: {
                    select: {
                        title: true,
                        difficulty: true
                    }
                }
            },
            orderBy: {
                submittedAt: 'desc'
            },
            take: 10
        });
        
        // Get submission statistics by language
        const pythonCount = await prisma.submission.count({
            where: { userId: userId, language: 'python' }
        });
        
        const cppCount = await prisma.submission.count({
            where: { userId: userId, language: 'cpp' }
        });
        
        // Get best runtimes (top 5)
        const bestRuntimes = await prisma.problemProgress.findMany({
            where: {
                userId: userId,
                bestRuntime: { not: null }
            },
            include: {
                problem: {
                    select: {
                        title: true,
                        difficulty: true
                    }
                }
            },
            orderBy: {
                bestRuntime: 'asc'
            },
            take: 5
        });
        
        return res.status(200).json({
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                memberSince: user.createdAt
            },
            statistics: {
                totalSubmissions: user.totalSubmissions,
                acceptedSubmissions: user.acceptedSubmissions,
                acceptanceRate: parseFloat(acceptanceRate),
                problemsSolved: user.problemsSolved
            },
            problemsByDifficulty: {
                easy: byDifficulty.easy,
                medium: byDifficulty.medium,
                hard: byDifficulty.hard
            },
            languageStats: {
                python: pythonCount,
                cpp: cppCount
            },
            recentActivity: recentSubmissions.map(sub => ({
                problemTitle: sub.problem.title,
                problemDifficulty: sub.problem.difficulty,
                status: sub.status,
                language: sub.language,
                runtime: sub.runtime,
                submittedAt: sub.submittedAt
            })),
            bestRuntimes: bestRuntimes.map(pr => ({
                problemTitle: pr.problem.title,
                problemDifficulty: pr.problem.difficulty,
                runtime: pr.bestRuntime
            }))
        });
        
    } catch (error) {
        console.error('Get user stats error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

/**
 * Get user's progress on all problems
 * GET /api/users/me/progress?status=solved&difficulty=easy
 */
const getAllProgress = async (req, res) => {
    try {
        const userId = req.user.id;
        const { status, difficulty } = req.query;
        
        // Build filter
        const where = {
            userId: userId
        };
        
        if (status && ['solved', 'attempted', 'not_attempted'].includes(status)) {
            where.status = status;
        }
        
        // Get all progress records
        const progressRecords = await prisma.problemProgress.findMany({
            where: where,
            include: {
                problem: {
                    select: {
                        id: true,
                        title: true,
                        difficulty: true,
                        tags: true,
                        acceptanceRate: true
                    }
                }
            },
            orderBy: {
                lastAttemptedAt: 'desc'
            }
        });
        
        // Filter by difficulty if specified
        let filteredRecords = progressRecords;
        if (difficulty) {
            filteredRecords = progressRecords.filter(
                pr => pr.problem.difficulty.toLowerCase() === difficulty.toLowerCase()
            );
        }
        
        // Format response
        const progress = filteredRecords.map(pr => ({
            problemId: pr.problemId,
            problemTitle: pr.problem.title,
            problemDifficulty: pr.problem.difficulty,
            problemTags: pr.problem.tags,
            status: pr.status,
            attempts: pr.attempts,
            acceptedSubmissions: pr.acceptedSubmissions,
            bestRuntime: pr.bestRuntime,
            lastAttemptedAt: pr.lastAttemptedAt,
            solvedAt: pr.solvedAt
        }));
        
        // Get summary counts
        const summary = {
            total: progressRecords.length,
            solved: progressRecords.filter(pr => pr.status === 'solved').length,
            attempted: progressRecords.filter(pr => pr.status === 'attempted').length
        };
        
        return res.status(200).json({
            summary: summary,
            progress: progress
        });
        
    } catch (error) {
        console.error('Get all progress error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

/**
 * Get user's progress on specific problem
 * GET /api/users/me/progress/:problemId
 */
const getProblemProgress = async (req, res) => {
    try {
        const userId = req.user.id;
        const problemId = parseInt(req.params.problemId);
        
        if (isNaN(problemId)) {
            return res.status(400).json({ error: 'Invalid problem ID' });
        }
        
        // Check if problem exists
        const problem = await prisma.problem.findUnique({
            where: { id: problemId },
            select: {
                id: true,
                title: true,
                difficulty: true,
                tags: true,
                acceptanceRate: true,
                totalSubmissions: true
            }
        });
        
        if (!problem) {
            return res.status(404).json({ error: 'Problem not found' });
        }
        
        // Get user's progress on this problem
        const progress = await prisma.problemProgress.findUnique({
            where: {
                userId_problemId: {
                    userId: userId,
                    problemId: problemId
                }
            }
        });
        
        // Get user's submissions for this problem
        const submissions = await prisma.submission.findMany({
            where: {
                userId: userId,
                problemId: problemId
            },
            select: {
                id: true,
                language: true,
                status: true,
                passedTests: true,
                totalTests: true,
                runtime: true,
                submittedAt: true
            },
            orderBy: {
                submittedAt: 'desc'
            }
        });
        
        // If no progress record exists, user hasn't attempted this problem
        if (!progress) {
            return res.status(200).json({
                problem: {
                    id: problem.id,
                    title: problem.title,
                    difficulty: problem.difficulty,
                    tags: problem.tags,
                    acceptanceRate: problem.acceptanceRate
                },
                progress: {
                    status: 'not_attempted',
                    attempts: 0,
                    acceptedSubmissions: 0,
                    bestRuntime: null,
                    lastAttemptedAt: null,
                    solvedAt: null
                },
                submissions: []
            });
        }
        
        return res.status(200).json({
            problem: {
                id: problem.id,
                title: problem.title,
                difficulty: problem.difficulty,
                tags: problem.tags,
                acceptanceRate: problem.acceptanceRate,
                totalSubmissions: problem.totalSubmissions
            },
            progress: {
                status: progress.status,
                attempts: progress.attempts,
                acceptedSubmissions: progress.acceptedSubmissions,
                bestRuntime: progress.bestRuntime,
                lastAttemptedAt: progress.lastAttemptedAt,
                solvedAt: progress.solvedAt
            },
            submissions: submissions
        });
        
    } catch (error) {
        console.error('Get problem progress error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

export {
    getUserStats,
    getAllProgress,
    getProblemProgress
};