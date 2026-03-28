import jwt from 'jsonwebtoken';
import prisma from '../../db.js'

const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            req.user = null;
            return next();
        }
        
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: {
                id: true,
                email: true,
                name: true
            }
        });
        
        req.user = user;
        next();
        
    } catch (error) {
        req.user = null;
        next();
    }
};

export default optionalAuth;