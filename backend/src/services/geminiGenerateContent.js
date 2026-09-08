const GEMINI_API_URL =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent';

const EXTRACTION_PROMPT = `You are given an image of a coding problem (like from LeetCode or a similar platform).
Extract the problem details and return a JSON object with exactly these fields:
- title: string
- description: string (full problem statement including examples and constraints),
  formatted as GitHub-flavoured Markdown: use fenced code blocks for code and
  sample I/O, bullet lists for constraints, and **bold** for emphasis
- difficulty: one of "easy", "medium", "hard"
- tags: array of relevant topic tags (e.g. ["array", "hash-table"])
- testCases: array of objects with { input: string, expectedOutput: string, isHidden: boolean }
  (isHidden should be false for all examples visible in the image)

Rules for testCases:
- input and expectedOutput must be raw values exactly as passed to/printed by the program
- Do NOT wrap values in quotes. If the output is the string bab, write bab not "bab"
- If input has multiple values, put each on its own line

Return ONLY valid JSON. No markdown fences, no explanation.`;

const stripSurroundingQuotes = (str) => {
    if (typeof str !== 'string') return str;
    if ((str.startsWith('"') && str.endsWith('"')) ||
        (str.startsWith("'") && str.endsWith("'"))) {
        return str.slice(1, -1);
    }
    return str;
};

export const extractProblemFromImage = async (base64Image, mimeType) => {
    const response = await fetch(`${GEMINI_API_URL}?key=${process.env.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [
                    { text: EXTRACTION_PROMPT },
                    { inline_data: { mime_type: mimeType, data: base64Image } },
                ],
            }],
        }),
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'Gemini API error');
    }

    const data = await response.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';

    const json = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
    const parsed = JSON.parse(json);

    if (Array.isArray(parsed.testCases)) {
        parsed.testCases = parsed.testCases.map(tc => ({
            ...tc,
            expectedOutput: stripSurroundingQuotes((tc.expectedOutput ?? '').trim()),
        }));
    }

    return parsed;
};
