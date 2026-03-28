import prisma from '../../db.js';

const checkProblemOwner = async (req, res, next) => {
    try{
        const problemId = parseInt(req.params.id);

        const problem = await prisma.problem.findUnique({
            where : {
                id : problemId
            }
        })

        if(!problem){
            return res.status(403).json({error : "This problem doesn't exist"});
        }

        if(problem.createdById !== req.user.id){
            return res.status(403).json({error : "Access denied"});
        }

        req.problem = problem;

        next();
    }
    catch(error){
        console.log("middleware");
        return res.status(500).json({error : "Server Error"});
    }
}

export default checkProblemOwner;