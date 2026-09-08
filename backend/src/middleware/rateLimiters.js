import rateLimit from 'express-rate-limit';

const limiter = (windowMs, max, message) =>
    rateLimit({
        windowMs,
        max,
        message: { error: message },
        standardHeaders: true,
        legacyHeaders: false,
    });

export const authLimiter = limiter(
    15 * 60 * 1000,
    20,
    'Too many attempts. Please try again later.'
);

export const submitLimiter = limiter(
    60 * 1000,
    10,
    'Too many submissions. Please slow down.'
);

export const imageLimiter = limiter(
    60 * 60 * 1000,
    20,
    'Image import limit reached. Please try again later.'
);
