import prisma from '../../db.js';

const createTestCase = async (req,res) => {
    try{
        const problemId = parseInt(req.params.id);
    
        const {input, expectedOutput, isHidden} = req.body;
    
        if(!input || !expectedOutput){
            return res.status(400).json({error : "Input and expectedOutput are required"})
        }
    
        if(input.trim === '' || expectedOutput.trim() === ''){
            return res.status(400).json({error : "Input and expectedOutput cannot be empty"})
        }
    
        const testCase = await prisma.testCase.create({
            data : {
                input,
                expectedOutput,
                isHidden : (isHidden ?? false),
                problemId
            }
        })
    
        return res.status(201).json({
            message : "Testcase added successfully",
            testCase
        })
    }
    catch(error){
        console.log("Error during Testcase creation");
        res.status(500).json({error : "Server error"});
    }
}

const updateTestCase = async (req, res) => {
    try {
        const problemId = parseInt(req.params.id);
        const tcId = parseInt(req.params.tcId);
        
        if (isNaN(problemId) || isNaN(tcId)) {
            return res.status(400).json({ error: 'Invalid ID' });
        }
        
        const { input, expectedOutput, isHidden } = req.body;
        
        const testCase = await prisma.testCase.findFirst({
            where: {
                id: tcId,
                problemId: problemId
            }
        });
        
        if (!testCase) {
            return res.status(404).json({ error: "Test case not found" });
        }
        
        const updateData = {};
        
        if (input !== undefined) {
            if (typeof input !== 'string' || input.trim() === '') {
                return res.status(400).json({ 
                    error: "Input cannot be empty" 
                });
            }
            updateData.input = input.trim();
        }
        
        if (expectedOutput !== undefined) {
            if (typeof expectedOutput !== 'string' || expectedOutput.trim() === '') {
                return res.status(400).json({ 
                    error: "Expected output cannot be empty" 
                });
            }
            updateData.expectedOutput = expectedOutput.trim();
        }
        
        if (isHidden !== undefined) {
            if (typeof isHidden !== 'boolean') {
                return res.status(400).json({ 
                    error: "isHidden must be a boolean" 
                });
            }
            updateData.isHidden = isHidden;
        }
        
        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ 
                error: 'At least one field must be provided to update' 
            });
        }
        
        const updated = await prisma.testCase.update({
            where: { id: tcId },
            data: updateData
        });
        
        return res.status(200).json({
            message: "Test case updated successfully",
            testCase: updated
        });
        
    } catch (error) {
        console.error("Error during testcase update:", error);
        return res.status(500).json({ error: "Server error" });
    }
};

const deleteTestCase = async (req, res) => {
    try {
        const problemId = parseInt(req.params.id);
        const tcId = parseInt(req.params.tcId);

        if(isNaN(problemId) || isNaN(tcId)){
            return res.status(400).json({error: 'Invalid ID'});
        }

        const testCase = await prisma.testCase.findFirst({
            where: {
                id: tcId,
                problemId: problemId
            }
        });

        if(!testCase){
            return res.status(404).json({ error: 'Test case not found' });
        }

        const testCaseCount = await prisma.testCase.count({
            where: { problemId: problemId }
        });

        if (testCaseCount <= 1) {
            return res.status(400).json({ 
                error: 'Cannot delete the last test case. Problem must have at least one test case.' 
            });
        }

        await prisma.testCase.delete({
            where: { id: tcId }
        });

        return res.status(200).json({ 
            message: 'Test case deleted successfully' 
        });

    } catch (error) {
        console.error('Delete test case error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};


const getTestCase = async (req, res) => {
    try {
        const problemId = parseInt(req.params.id);
        const testCaseId = parseInt(req.params.tcId);

        if(isNaN(problemId) || isNaN(testCaseId)){
            return res.status(400).json({error: 'Invalid ID'});
        }

        const testCase = await prisma.testCase.findFirst({
            where: {
                id: testCaseId,
                problemId: problemId
            }
        });

        if(!testCase){
            return res.status(404).json({error: 'Test case not found'});
        }

        const problem = await prisma.problem.findUnique({
            where: { id: problemId }
        });

        const isOwner = req.user && problem.createdById === req.user.id;

        if (testCase.isHidden && !isOwner) {
            return res.status(403).json({ 
                error: 'Access denied. This test case is hidden.' 
            });
        }

        return res.status(200).json({ testCase });

    } catch (error) {
        console.error('Get test case error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
}



const getTestCases = async (req, res) => {
    try {
        const problemId = parseInt(req.params.id);

        if (isNaN(problemId)) {
            return res.status(400).json({ 
                error: 'Invalid problem ID' 
            });
        }

        const problem = await prisma.problem.findUnique({
            where: { id: problemId }
        });

        if (!problem) {
            return res.status(404).json({ 
                error: 'Problem not found' 
            });
        }

        const isOwner = req.user && problem.createdById === req.user.id;

        const testCases = await prisma.testCase.findMany({
            where: {
                problemId: problemId,
                ...(isOwner ? {} : { isHidden: false })
            },
            orderBy: {
                id: 'asc'
            }
        });

        return res.status(200).json({ 
            testCases,
            count: testCases.length
        });

    } catch (error) {
        console.error('Get test cases error:', error);
        return res.status(500).json({ 
            error: 'Server error' 
        });
    }
};

export {getTestCase, createTestCase, deleteTestCase, updateTestCase, getTestCases}