

const authProblem = async (req,res,next) => {
    const {title, description, difficulty, tags, testCases} = req.body;

    if(!title || !description || !difficulty){
        return res.status(400).json({error : "Title, description, and difficulty are required"})
    }

    const difficultyRating = ['easy', 'medium', 'hard'];

    if(!difficultyRating.includes(difficulty)){
        return res.status(400).json({error : "Enter Valid Difficulty"})
    }

    if(!tags || !Array.isArray(tags)){
        return res.status(400).json({error : "Enter valid tags"})
    }

    if(!testCases || !Array.isArray(testCases)){
        return res.status(400).json({error : "Enter valid testCases"});
    }

    if(testCases.length == 0){
        return res.status(400).json({error : "Enter atleast one testCase"});
    }

    for(let i=0; i<testCases.length; i++){
        let testCase = testCases[i];

        if (typeof testCase !== 'object' || testCase === null) {
            return res.status(400).json({ error : `Test case ${i + 1} must be an object`});
        }

        if(typeof testCase.input !== 'string' || !testCase.input || testCase.input.trim() == ''){
            res.status(400).json({error : `Enter valid input for ${i+1} testCase`});
        }

        if(typeof testCase.expectedOutput !== 'string' || !testCase.expectedOutput || testCase.expectedOutput.trim() == ''){
            res.status(400).json({error : `Enter valid expectedOutput for ${i+1} testCase`});
        }

        if(!testCase.input || testCase.input.trim() == ''){
            res.status(400).json({error : `Enter valid input for ${i+1} testCase`});
        }

        if(testCase.hasOwnProperty('isHidden') && typeof testCase.isHidden !== 'boolean'){
            return res.status(400).json({ 
                error: `Test case ${i + 1}: isHidden must be true or false` 
            });
        }
    }
    next();
}

export default authProblem;