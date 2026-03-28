import jwt from 'jsonwebtoken';
import prisma from '../../db.js';

const authUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if(!authHeader || !authHeader.startsWith('Bearer ')){
        return res.status(401).json({error : "No token provided. Authorization denied"})
    }

    const token = authHeader.split(' ')[1];

    const derivedUser = jwt.verify(token,process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
        where : {
            id : derivedUser.userId
        },
        select : {
            id : true,
            name : true,
            email : true,
            createdAt : true
        }
    })

    if(!user){
        return res.status(401).json({error : "User not found. Authorization denied"})
    }

    req.user = user;

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Invalid token' 
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired' 
      });
    }

    res.status(500).json({ 
      error: 'Server error in authentication' 
    });
  }
};

export default authUser;