import prisma from '../../db.js';

const createProblem = async (req,res) => {
    try{
        const {title, description, difficulty, tags, testCases} = req.body;

        const problem = await prisma.problem.create({
            data : {
                title : title.trim(),
                description : description.trim(),
                difficulty : difficulty.toLowerCase(),
                tags : tags || [],
                createdById : req.user.id,
                testCases : {
                    create : testCases.map(tc => ({
                        input: tc.input.trim(),
                        expectedOutput: tc.expectedOutput.trim(),
                        isHidden: tc.isHidden || false
                    }))
                }
            },
            include: {
                testCases: {
                    where: { isHidden: false }
                },
                createdBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            }
        });

        res.status(201).json({
            message: 'Problem created successfully',
            problem
        });
    }
    catch(error){
        res.status(500).json({ error: 'Failed to create problem' });
    }
}


const updateProblem = async(req,res) => {
    try{
        const {title, description, difficulty, tags} = req.body;

        if(!title || !description || !difficulty){
            return res.status(400).json({ error: 'Title, description, and difficulty are required'});
        }

        if(typeof title !== 'string' || title.trim().length < 3){
            return res.status(400).json({error: 'Title must be at least 3 characters'});
        }

        if(title.length > 200){
            return res.status(400).json({error: 'Title must be less than 200 characters'});
        }

        if(typeof description !== 'string' || description.trim().length < 10){
            return res.status(400).json({error: 'Description must be at least 10 characters'});
        }

        if (!['easy', 'medium', 'hard'].includes(difficulty.toLowerCase())) {
            return res.status(400).json({error: "Difficulty must be 'easy', 'medium', or 'hard'"});
        }

        if (tags !== undefined && !Array.isArray(tags)) {
            return res.status(400).json({error: 'Tags must be an array'});
        }

        if (tags && tags.length > 0) {
            for (let i = 0; i < tags.length; i++) {
                if (typeof tags[i] !== 'string' || tags[i].trim() === '') {
                    return res.status(400).json({error: `Tag ${i + 1} must be a non-empty string`});
                }
            }
        }

        const updated = await prisma.problem.update({
            where : {id : req.problem.id},
            data : {
                title,
                description,
                difficulty,
                tags
            }
        })

        return res.json({problem : updated});

    }
    catch(error){
        return res.json({error : "Server error"});
    }
}

const getProblem = async(req,res) => {
    try{
        const problemId = parseInt(req.params.id);

        const currProblem = await prisma.problem.findUnique({
            where : {id : problemId},
            include : {
                testCases: {
                    where: { isHidden: false }
                },
                createdBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            }
        })

        if(!currProblem){
            return res.status(404).json({error : "This problem doesn't exist"});
        }

        return res.json({problem : currProblem});

    }
    catch(error){
        return res.json({error : "Server error"});
    }
}

const getAllProblems = async (req, res) => {
    try {
        const userId = req.user?.id;

        const { difficulty, tags, search, page = 1, limit = 20 } = req.query;

        const where = {};

        if(difficulty){
            where.difficulty = difficulty.toLowerCase();
        }

        if(tags){
            const tagArray = Array.isArray(tags) ? tags : [tags];
            where.tags = {
                hasEvery: tagArray
            };
        }

        if(search){
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);

        const [problems, totalCount] = await Promise.all([
            prisma.problem.findMany({
                where,
                skip,
                take,
                orderBy: {
                    createdAt: 'desc'
                },
                include: {
                    createdBy: {
                        select: {
                            id: true,
                            name: true
                        }
                    },
                    _count: {
                        select: {
                            testCases: true
                        }
                    }
                }
            }),
            prisma.problem.count({ where })
        ]);

        let progressMap = {};
        if (userId) {
            const userProgress = await prisma.problemProgress.findMany({
                where: { userId: userId }
            });
            
            userProgress.forEach(p => {
                progressMap[p.problemId] = p.status;
            });
        }

        const totalPages = Math.ceil(totalCount / take);
        const hasMore = page < totalPages;

        return res.status(200).json({
            problems: problems.map(p => ({
                id: p.id,
                title: p.title,
                difficulty: p.difficulty,
                tags: p.tags,
                acceptanceRate: p.acceptanceRate,
                totalSubmissions: p.totalSubmissions,
                myStatus: progressMap[p.id] || 'not_attempted',
                createdBy: p.createdBy.name,
                testCaseCount: p._count?.testCases ?? 0
            })),
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalCount,
                limit: take,
                hasMore
            }
        });

    } catch (error) {
        console.error('Get all problems error:', error);
        return res.status(500).json({ 
            error: "Server error" 
        });
    }
};



const deleteProblem = async (req, res) => {
    try {
        const problemId = parseInt(req.params.id);

        if(isNaN(problemId)){
            return res.status(400).json({error: "Invalid problem ID"});
        }

        await prisma.problem.delete({where: { id: problemId }});

        return res.status(200).json({message: "Problem deleted successfully"});

    }
    catch(error){
        console.error('Delete problem error:', error);
        return res.status(500).json({error: "Failed to delete problem"});
    }
};

const getAllTags = async (req, res) => {
    try {
        const result = await prisma.$queryRaw`
            SELECT DISTINCT unnest(tags) AS tag
            FROM "Problem"
            ORDER BY tag
        `;
        const tags = (result || []).map((r) => r.tag).filter(Boolean);
        return res.status(200).json({ tags });
    } catch (error) {
        console.error('Get all tags error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

export { createProblem, updateProblem, getProblem, getAllProblems, deleteProblem, getAllTags }