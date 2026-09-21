const parseLiterals = (text) => {
    let i = 0;
    const skip = () => { while (i < text.length && /[\s,]/.test(text[i])) i++; };

    const value = () => {
        skip();
        const c = text[i];
        if (c === '[') {
            i++;
            const items = [];
            for (;;) {
                skip();
                if (text[i] === ']') { i++; return items; }
                if (i >= text.length) throw new Error('unclosed [');
                items.push(value());
            }
        }
        if (c === '"' || c === "'") {
            const end = text.indexOf(c, i + 1);
            if (end === -1) throw new Error('unclosed quote');
            const s = text.slice(i + 1, end);
            i = end + 1;
            return s;
        }
        const m = /^(-?\d+(\.\d+)?|true|false|True|False|null|None)(?![\w.])/.exec(text.slice(i));
        if (!m) throw new Error('unknown token');
        i += m[0].length;
        if (/^(true|True)$/.test(m[0])) return true;
        if (/^(false|False)$/.test(m[0])) return false;
        if (/^(null|None)$/.test(m[0])) return null;
        return { num: m[0] }; // kept as text so big integers don't lose precision
    };

    const values = [];
    skip();
    while (i < text.length) {
        const name = /^[A-Za-z_]\w*\s*=(?!=)/.exec(text.slice(i));
        if (name) i += name[0].length;
        values.push(value());
        skip();
    }
    return values;
};

const isScalar = (v) => !Array.isArray(v);
const scalar = (v) => (v === null ? 'null' : v.num ?? String(v));

const format = (v, withLength) => {
    if (isScalar(v)) return scalar(v);
    if (v.length > 0 && v.every((x) => typeof x === 'string' && x.length === 1)) return v.join('');
    if (v.every(isScalar)) {
        const row = v.map(scalar).join(' ');
        return withLength ? `${v.length}\n${row}` : row;
    }
    if (v.every((r) => Array.isArray(r) && r.every(isScalar))) {
        const rows = v.map((r) => r.map(scalar).join(' '));
        if (!withLength) return rows.join('\n');
        const rect = v.every((r) => r.length === v[0].length);
        return rect
            ? [`${v.length} ${v[0]?.length ?? 0}`, ...rows].join('\n')
            : [`${v.length}`, ...v.map((r, k) => `${r.length} ${rows[k]}`.trim())].join('\n');
    }
    throw new Error('nested too deep');
};

const convert = (text, withLength) => {
    const trimmed = String(text ?? '').trim();
    if (!/[[\]='"]/.test(trimmed)) return trimmed;
    try {
        const out = parseLiterals(trimmed).map((v) => format(v, withLength)).join('\n').trim();
        return out === '' ? trimmed : out;
    } catch {
        return trimmed;
    }
};

export const toCodeforcesInput = (text) => convert(text, true);
export const toCodeforcesOutput = (text) => convert(text, false);
