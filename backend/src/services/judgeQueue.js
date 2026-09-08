import os from 'os';

const CONCURRENCY =
    Number(process.env.JUDGE_CONCURRENCY) || Math.max(2, os.cpus().length - 1);

const MAX_WAITING = Number(process.env.JUDGE_MAX_WAITING) || CONCURRENCY * 4;

let active = 0;
const waiters = [];
const judgingUsers = new Set();

export const isSaturated = () => waiters.length >= MAX_WAITING;

export const acquire = () => {
    if (active < CONCURRENCY) {
        active++;
        return Promise.resolve();
    }

    return new Promise((resolve) => waiters.push(resolve));
};

export const release = () => {
    const next = waiters.shift();

    if (next) next();
    else active--;
};

export const tryClaimUser = (userId) => {
    if (judgingUsers.has(userId)) return false;

    judgingUsers.add(userId);
    return true;
};

export const releaseUser = (userId) => judgingUsers.delete(userId);

export const stats = () => ({
    active,
    waiting: waiters.length,
    concurrency: CONCURRENCY,
    maxWaiting: MAX_WAITING,
});
