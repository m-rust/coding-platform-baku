import { extractProblemFromImage } from '../services/geminiGenerateContent.js';

const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

export const extractProblemFromImageController = async (req, res) => {
    const { base64, mimeType } = req.body;

    if (typeof base64 !== 'string' || typeof mimeType !== 'string' || !base64 || !mimeType) {
        return res.status(400).json({ error: 'base64 and mimeType are required' });
    }

    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
        return res.status(400).json({
            error: `Unsupported image type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
        });
    }

    if (!BASE64_PATTERN.test(base64)) {
        return res.status(400).json({ error: 'Image data is not valid base64' });
    }

    const decodedBytes = Math.floor((base64.length * 3) / 4);

    if (decodedBytes > MAX_IMAGE_BYTES) {
        return res.status(413).json({
            error: `Image is too large (max ${MAX_IMAGE_BYTES / (1024 * 1024)}MB)`,
        });
    }

    try {
        const problemData = await extractProblemFromImage(base64, mimeType);
        res.json(problemData);
    } catch (err) {
        console.error('Image extraction failed:', err);
        res.status(502).json({ error: 'Could not read the problem from that image.' });
    }
};
