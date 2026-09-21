import { toCodeforcesInput, toCodeforcesOutput } from './toCodeforces.js';

const GEMINI_API_URL =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent';

const EXTRACTION_PROMPT = `You are given an image of a coding problem (like from LeetCode or a similar platform).
Extract the problem details and return a JSON object with exactly these fields:
- title: string
- description: string (full problem statement, an "Input Format" and an "Output Format"
  section describing the plain-text test data below, and constraints),
  formatted as GitHub-flavoured Markdown: use fenced code blocks for code and
  sample I/O, bullet lists for constraints, and **bold** for emphasis
- difficulty: one of "easy", "medium", "hard"
- tags: array of relevant topic tags (e.g. ["array", "hash-table"])
- testCases: array of objects with { input: string, expectedOutput: string, isHidden: boolean }
  (isHidden should be false for all examples visible in the image)

Rules for testCases (Codeforces-style plain text, read from stdin / printed to stdout):
- No variable names, brackets, commas or quotes. Not "nums = [2,7,11,15], target = 9"
- Each value on its own line. An array is its length on one line, then its elements
  space-separated on the next: input "4
2 7 11 15
9"
- A string is written as-is: bab, not "bab" or ['b','a','b']
- A 2D array is "rows cols" on one line, then one row per line
- expectedOutput arrays are just the elements space-separated, without the length: "0 1"

Return ONLY valid JSON. No markdown fences, no explanation.`;

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
            // Gemini doesn't always follow the format rules; normalise anyway
            input: toCodeforcesInput(tc.input),
            expectedOutput: toCodeforcesOutput(tc.expectedOutput),
        }));
    }

    return parsed;
};
