import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../../db.js';

const ACCESS_TOKEN_EXPIRES_IN = '1m';
const REFRESH_TOKEN_EXPIRES_IN = '7d';
const REFRESH_TOKEN_MS = 7 * 24 * 60 * 60 * 1000;

const generateAccessToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
  );
};

/** Creates a refresh token record in DB and returns the signed JWT. */
const createRefreshTokenForUser = async (userId) => {
  const tokenId = uuidv4();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_MS);

  await prisma.refreshToken.create({
    data: {
      id: tokenId,
      userId,
      expiresAt,
    },
  });

  return jwt.sign(
    { userId, tokenId },
    process.env.JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
  );
};

const sendAuthResponse = async (res, user, message = 'Authenticated successfully') => {
  const accessToken = generateAccessToken(user.id);
  const refreshToken = await createRefreshTokenForUser(user.id);

  return res.status(200).json({
    message,
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
  });
};

const register = async (req, res) => {
  try {
    const username = req.body.name;
    const { email, password } = req.body;

    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        email: email,
      },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists!' });
    }

    const hashedpswd = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email: email,
        password: hashedpswd,
        name: username,
      },
    });

    return await sendAuthResponse(res, user, 'User created successfully!');
  } catch (error) {
    console.error('Error during registration:', error);
    return res.status(500).json({
      error: 'Server error during registration',
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({
      where: {
        email: email,
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid Credentials' });
    }

    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      return res.status(401).json({ error: 'Incorrect Password' });
    }

    return await sendAuthResponse(res, user, 'User successfully logged in');
  } catch (error) {
    console.error('Error during login:', error);
    return res.status(500).json({ error: 'Server error during user login' });
  }
};

const refreshAccessToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

    if (!decoded.tokenId) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const stored = await prisma.refreshToken.findUnique({
      where: { id: decoded.tokenId },
      include: { user: true },
    });

    if (!stored) {
      return res.status(401).json({ error: 'Refresh token not found' });
    }
    if (stored.revokedAt) {
      return res.status(401).json({ error: 'Refresh token has been revoked' });
    }
    if (stored.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Refresh token expired' });
    }

    const user = stored.user;

    // Rotation: revoke current token, issue new one
    await prisma.refreshToken.update({
      where: { id: decoded.tokenId },
      data: { revokedAt: new Date() },
    });

    const newAccessToken = generateAccessToken(user.id);
    const newRefreshToken = await createRefreshTokenForUser(user.id);

    return res.status(200).json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    console.error('Error refreshing access token:', error);

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Refresh token expired' });
    }

    return res.status(401).json({ error: 'Invalid refresh token' });
  }
};

const logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    } catch {
      return res.status(200).json({ message: 'Logged out' });
    }

    if (!decoded.tokenId) {
      return res.status(200).json({ message: 'Logged out' });
    }

    await prisma.refreshToken.updateMany({
      where: { id: decoded.tokenId },
      data: { revokedAt: new Date() },
    });

    return res.status(200).json({ message: 'Logged out' });
  } catch (error) {
    console.error('Error during logout:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

const getCurrentUser = async (req, res) => {
  try {
    res.json({
      user: {
        name: req.user.name,
        email: req.user.email,
        userId: req.user.id,
      },
    });
  } catch (error) {
    console.error('Get current user error:', error);
    return res.status(500).json({
      error: 'Server error',
    });
  }
};

export {
  register,
  login,
  refreshAccessToken,
  logout,
  getCurrentUser,
};