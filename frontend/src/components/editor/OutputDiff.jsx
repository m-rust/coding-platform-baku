const splitLines = (value) => String(value ?? '').replace(/\r\n/g, '\n').split('\n');

const OutputDiff = ({ expected, actual }) => {
  const expectedLines = splitLines(expected);
  const actualLines = splitLines(actual);
  const lineCount = Math.max(expectedLines.length, actualLines.length);

  const normalize = (line) => String(line ?? '').trim().replace(/\s+/g, ' ');

  let firstDiff = -1;
  for (let i = 0; i < lineCount; i++) {
    if (normalize(expectedLines[i]) !== normalize(actualLines[i])) {
      firstDiff = i;
      break;
    }
  }

  const column = (title, lines, tone) => (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">{title}</div>
      <div className="rounded border border-slate-800 bg-slate-950 overflow-x-auto">
        {lines.length === 0 || (lines.length === 1 && lines[0] === '') ? (
          <div className="px-2 py-1 text-[11px] text-slate-600 italic">(no output)</div>
        ) : (
          lines.map((line, i) => {
            const isDiff = i === firstDiff;
            return (
              <div
                key={i}
                className={`flex gap-2 px-2 py-0.5 font-mono text-[11px] whitespace-pre ${
                  isDiff ? `${tone} font-medium` : 'text-slate-300'
                }`}
              >
                <span className="select-none text-slate-600 w-5 shrink-0 text-right">{i + 1}</span>
                <span>{line === '' ? ' ' : line}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-2 gap-2">
        {column('Expected', expectedLines, 'bg-emerald-500/10 text-emerald-300')}
        {column('Your output', actualLines, 'bg-rose-500/10 text-rose-300')}
      </div>
      {firstDiff >= 0 && (
        <p className="text-[11px] text-amber-400">
          First difference on line {firstDiff + 1}
          {expectedLines.length !== actualLines.length &&
            ` · expected ${expectedLines.length} line${expectedLines.length === 1 ? '' : 's'}, got ${actualLines.length}`}
        </p>
      )}
    </div>
  );
};

export default OutputDiff;
