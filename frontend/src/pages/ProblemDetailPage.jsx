import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api.js';
import LoadingSpinner from '../components/common/LoadingSpinner.jsx';
import CodeEditor from '../components/editor/CodeEditor.jsx';
import TestResults from '../components/editor/TestResults.jsx';

const defaultStarterCode = {
  python: '# Write your code here\n\na = int(input())\nb = int(input())\nprint(a + b)\n',
  cpp: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n\n    int a, b;\n    if (!(cin >> a >> b)) return 0;\n    cout << a + b;\n    return 0;\n}\n',
};

const ProblemDetailPage = () => {
  const { id } = useParams();
  const [problem, setProblem] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [language, setLanguage] = useState('python');
  const [code, setCode] = useState(defaultStarterCode.python);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submission, setSubmission] = useState(null);
  const [testResults, setTestResults] = useState([]);

  useEffect(() => {
    const fetchProblem = async () => {
      setIsLoading(true);
      setError('');
      try {
        const response = await api.get(`/problems/${id}`);
        setProblem(response.data.problem);
      } catch (err) {
        const message =
          err.response?.data?.error ||
          err.message ||
          'Failed to load problem';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProblem();
  }, [id]);

  const handleLanguageChange = (newLang) => {
    setLanguage(newLang);
    if (!code || code === defaultStarterCode.python || code === defaultStarterCode.cpp) {
      setCode(defaultStarterCode[newLang]);
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const response = await api.post('/submissions', {
        problemId: Number(id),
        code,
        language,
      });

      setSubmission(response.data.submission);
      setTestResults(response.data.testResults || []);
      toast.success('Submission evaluated');
    } catch (err) {
      const message =
        err.response?.data?.error ||
        err.message ||
        'Failed to submit code';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="text-sm text-rose-400">
        Failed to load problem: {error}
      </div>
    );
  }

  if (!problem) {
    return (
      <div className="text-sm text-slate-400">Problem not found.</div>
    );
  }

  const difficulty = problem.difficulty?.toLowerCase() || 'easy';

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.1fr)]">
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-50">
              {problem.title}
            </h2>
            <p className="text-xs text-slate-400">
              Difficulty: {difficulty} •{' '}
              {problem.acceptanceRate?.toFixed
                ? `${problem.acceptanceRate.toFixed(1)}%`
                : `${problem.acceptanceRate ?? 0}%`}{' '}
              acceptance
            </p>
          </div>
        </div>
        <article className="prose prose-invert prose-sm max-w-none bg-slate-900/60 border border-slate-800 rounded-lg p-4">
          <pre className="whitespace-pre-wrap text-slate-100 text-[13px]">
            {problem.description}
          </pre>
        </article>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => handleLanguageChange('python')}
              className={`px-3 py-1.5 rounded-md border text-xs font-medium ${
                language === 'python'
                  ? 'bg-slate-800 border-slate-600 text-slate-50'
                  : 'bg-slate-900 border-slate-800 text-slate-300'
              }`}
            >
              Python
            </button>
            <button
              type="button"
              onClick={() => handleLanguageChange('cpp')}
              className={`px-3 py-1.5 rounded-md border text-xs font-medium ${
                language === 'cpp'
                  ? 'bg-slate-800 border-slate-600 text-slate-50'
                  : 'bg-slate-900 border-slate-800 text-slate-300'
              }`}
            >
              C++
            </button>
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-1.5 rounded-md bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Running...' : 'Submit'}
          </button>
        </div>

        <CodeEditor language={language} code={code} onChange={setCode} />

        <TestResults submission={submission} testResults={testResults} />
      </section>
    </div>
  );
};

export default ProblemDetailPage;

