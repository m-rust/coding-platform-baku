import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../../db.js';

const ACCESS_TOKEN_EXPIRES_IN = '1m';
const REFRESH_TOKEN_EXPIRES_IN = '7d';
const REFRESH_TOKEN_MS = 7 * 24 * 60 * 60 * 1000;
const REFRESH_COOKIE = 'refresh_token';
const MIN_PASSWORD_LENGTH = 8;

const DUMMY_HASH = bcrypt.hashSync('invalid-placeholder-password', 10);

const refreshCookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/api/auth',
};

const generateAccessToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.ACCESS_JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
  );
};

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
    process.env.REFRESH_JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
  );
};

const sendAuthResponse = async (res, user, message = 'Authenticated successfully') => {
  const accessToken = generateAccessToken(user.id);
  const refreshToken = await createRefreshTokenForUser(user.id);

  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...refreshCookieOptions,
    maxAge: REFRESH_TOKEN_MS,
  });

  return res.status(200).json({
    message,
    accessToken,
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

    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Enter a valid email address' });
    }

    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      });
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

    const isValid = await bcrypt.compare(password, user ? user.password : DUMMY_HASH);

    if (!user || !isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    return await sendAuthResponse(res, user, 'User successfully logged in');
  } catch (error) {
    console.error('Error during login:', error);
    return res.status(500).json({ error: 'Server error during user login' });
  }
};

const refreshAccessToken = async (req, res) => {
  try {
    const refreshToken = req.cookies[REFRESH_COOKIE];

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token is required' });
    }

    const decoded = jwt.verify(refreshToken, process.env.REFRESH_JWT_SECRET);

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

    await prisma.refreshToken.update({
      where: { id: decoded.tokenId },
      data: { revokedAt: new Date() },
    });

    const newAccessToken = generateAccessToken(user.id);
    const newRefreshToken = await createRefreshTokenForUser(user.id);

    res.cookie(REFRESH_COOKIE, newRefreshToken, {
      ...refreshCookieOptions,
      maxAge: REFRESH_TOKEN_MS,
    });

    return res.status(200).json({ accessToken: newAccessToken });
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
    const refreshToken = req.cookies[REFRESH_COOKIE];
    res.clearCookie(REFRESH_COOKIE, refreshCookieOptions);

    if (!refreshToken) {
      return res.status(200).json({ message: 'Logged out' });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.REFRESH_JWT_SECRET);
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
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
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