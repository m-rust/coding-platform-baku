const statusColors = {
  accepted: 'text-emerald-400',
  wrong_answer: 'text-rose-400',
  time_limit_exceeded: 'text-amber-400',
  compilation_error: 'text-rose-400',
  runtime_error: 'text-rose-400',
};

const TestResults = ({ submission, testResults }) => {
  if (!submission) return null;

  const status = submission.status;
  const statusColor = statusColors[status] || 'text-slate-200';

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className={`font-medium ${statusColor}`}>
          {status.replace(/_/g, ' ').toUpperCase()}
        </div>
        <div className="text-xs text-slate-400">
          {submission.passedTests}/{submission.totalTests} tests passed •{' '}
          {submission.runtime}ms
        </div>
      </div>

      <div className="border border-slate-800 rounded-lg divide-y divide-slate-800 bg-slate-950/60 max-h-80 overflow-y-auto">
        {testResults.map((tr) => (
          <div key={tr.testCaseId} className="p-3 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-200">
                Test #{tr.testCaseId}
              </span>
              <span
                className={
                  tr.passed ? 'text-emerald-400 font-medium' : 'text-rose-400'
                }
              >
                {tr.passed ? 'Passed' : 'Failed'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-1">
              <div>
                <div className="text-slate-400 mb-0.5">Input</div>
                <pre className="bg-slate-900 rounded px-2 py-1 text-[11px] whitespace-pre-wrap">
                  {tr.input}
                </pre>
              </div>
              <div>
                <div className="text-slate-400 mb-0.5">Your output</div>
                <pre className="bg-slate-900 rounded px-2 py-1 text-[11px] whitespace-pre-wrap">
                  {tr.userOutput}
                </pre>
              </div>
              <div>
                <div className="text-slate-400 mb-0.5">Expected</div>
                <pre className="bg-slate-900 rounded px-2 py-1 text-[11px] whitespace-pre-wrap">
                  {tr.expectedOutput}
                </pre>
              </div>
            </div>
            {tr.error && (
              <div className="mt-1 text-[11px] text-amber-300">
                {tr.error}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TestResults;

