import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import toast from 'react-hot-toast';
import OutputDiff from '../components/editor/OutputDiff.jsx';
import api from '../services/api.js';
import { useAuthStore } from '../store/authStore.js';
import LoadingSpinner from '../components/common/LoadingSpinner.jsx';

const DIFFICULTIES = ['easy', 'medium', 'hard'];

const POLL_INTERVAL_MS = 500;
const POLL_TIMEOUT_MS = 120000;

const FALLBACK_LANGUAGES = [
  { id: 'python', label: 'Python' },
  { id: 'cpp', label: 'C++' },
];

const defaultStarterCode = {
  python: '# Write your solution here\n\n',
  javascript: 'const lines = require("fs").readFileSync(0, "utf8").split("\\n");\n\n',
  cpp: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n\n    \n    return 0;\n}\n',
};

const difficultyConfig = {
  easy:   { label: 'Easy',   cls: 'text-emerald-400 bg-emerald-400/10 border border-emerald-400/20' },
  medium: { label: 'Medium', cls: 'text-amber-400  bg-amber-400/10  border border-amber-400/20'  },
  hard:   { label: 'Hard',   cls: 'text-rose-400   bg-rose-400/10   border border-rose-400/20'   },
};

const statusColors = {
  accepted:             'text-emerald-400',
  wrong_answer:         'text-rose-400',
  time_limit_exceeded:  'text-amber-400',
  compilation_error:    'text-rose-400',
  runtime_error:        'text-rose-400',
};

const TABS = ['Description', 'Submissions'];

const ProblemDetailPage = () => {
  const { id } = useParams();

  const [problem, setProblem]       = useState(null);
  const [isLoading, setIsLoading]   = useState(true);
  const [error, setError]           = useState('');
  const [activeTab, setActiveTab]   = useState('Description');

  const [language, setLanguage]         = useState('python');
  const [codeByLanguage, setCodeByLanguage] = useState(defaultStarterCode);
  const code = codeByLanguage[language] ?? '';
  const setCode = (value) =>
    setCodeByLanguage((prev) => ({ ...prev, [language]: value }));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submission, setSubmission]     = useState(null);
  const [testResults, setTestResults]   = useState([]);

  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.user);

  const [languages, setLanguages] = useState(FALLBACK_LANGUAGES);

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm]   = useState(null);
  const [isSaving, setIsSaving]   = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isOwner = Boolean(currentUser && problem?.createdBy?.id === currentUser.id);

  const startEditing = () => {
    setEditForm({
      title: problem.title,
      description: problem.description,
      difficulty: (problem.difficulty || 'easy').toLowerCase(),
      tagsInput: (problem.tags || []).join(', '),
    });
    setIsEditing(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (isSaving) return;

    setIsSaving(true);
    try {
      const res = await api.patch(`/problems/${id}`, {
        title: editForm.title.trim(),
        description: editForm.description.trim(),
        difficulty: editForm.difficulty,
        tags: editForm.tagsInput.split(',').map((t) => t.trim()).filter(Boolean),
      });

      setProblem((prev) => ({ ...prev, ...res.data.problem }));
      setIsEditing(false);
      toast.success('Problem updated');
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Update failed');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (isDeleting) return;
    if (!window.confirm(`Delete "${problem.title}"? This also removes its test cases and every submission to it.`)) {
      return;
    }

    setIsDeleting(true);
    try {
      await api.delete(`/problems/${id}`);
      toast.success('Problem deleted');
      navigate('/problems', { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Delete failed');
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    const fetchProblem = async () => {
      setIsLoading(true);
      setError('');
      try {
        const res = await api.get(`/problems/${id}`);
        setProblem(res.data.problem);
      } catch (err) {
        setError(err.response?.data?.error || err.message || 'Failed to load problem');
      } finally {
        setIsLoading(false);
      }
    };
    fetchProblem();
  }, [id]);

  const handleLanguageChange = (lang) => setLanguage(lang);

  useEffect(() => {
    api
      .get('/languages')
      .then((res) => {
        if (res.data.languages?.length) setLanguages(res.data.languages);
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    setSubmission(null);
    setTestResults([]);

    try {
      const res = await api.post('/submissions', { problemId: Number(id), code, language });
      const submissionId = res.data.submission.id;

      const deadline = Date.now() + POLL_TIMEOUT_MS;

      for (;;) {
        if (Date.now() > deadline) {
          throw new Error('Timed out waiting for the judge');
        }

        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

        const poll = await api.get(`/submissions/${submissionId}`);

        if (poll.data.submission.status !== 'pending') {
          setSubmission(poll.data.submission);
          setTestResults(poll.data.testResults || []);
          toast.success('Submission evaluated');
          return;
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return (
    <div className="flex-1 flex items-center justify-center">
      <LoadingSpinner />
    </div>
  );

  if (error || !problem) return (
    <div className="flex-1 flex items-center justify-center text-rose-400 text-sm">
      {error || 'Problem not found.'}
    </div>
  );

  const difficulty  = problem.difficulty?.toLowerCase() || 'easy';
  const diffStyle   = difficultyConfig[difficulty] || difficultyConfig.easy;
  const visibleTCs  = (problem.testCases || []).filter(tc => !tc.isHidden);
  const statusColor = submission ? (statusColors[submission.status] || 'text-slate-200') : '';

  return (
    <div className="flex-1 flex overflow-hidden">

      <div className="w-[38%] min-w-[280px] flex flex-col border-r border-slate-800 overflow-hidden bg-slate-900/30">

        <div className="flex shrink-0 border-b border-slate-800">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-3 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'text-slate-50 border-b-2 border-indigo-500 -mb-px'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {activeTab === 'Description' && (
            <>
              {isEditing ? (

                <form onSubmit={handleSave} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Title</label>
                    <input
                      type="text"
                      value={editForm.title}
                      onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                      required
                      minLength={3}
                      maxLength={200}
                      className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Difficulty</label>
                    <select
                      value={editForm.difficulty}
                      onChange={e => setEditForm({ ...editForm, difficulty: e.target.value })}
                      className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {DIFFICULTIES.map(d => (
                        <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Tags (comma-separated)</label>
                    <input
                      type="text"
                      value={editForm.tagsInput}
                      onChange={e => setEditForm({ ...editForm, tagsInput: e.target.value })}
                      placeholder="e.g. array, hash-table"
                      className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Description</label>
                    <textarea
                      value={editForm.description}
                      onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                      required
                      minLength={10}
                      rows={10}
                      className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="px-4 py-1.5 rounded-md bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-400 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isSaving ? 'Saving…' : 'Save changes'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      disabled={isSaving}
                      className="px-4 py-1.5 rounded-md border border-slate-600 text-slate-200 text-sm font-medium hover:bg-slate-800 disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <h1 className="text-xl font-semibold text-slate-50 leading-snug">
                      {problem.title}
                    </h1>

                    {isOwner && (
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={startEditing}
                          className="px-2.5 py-1 rounded-md border border-slate-700 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-slate-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={handleDelete}
                          disabled={isDeleting}
                          className="px-2.5 py-1 rounded-md border border-rose-500/40 text-xs font-medium text-rose-400 hover:bg-rose-500/10 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {isDeleting ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${diffStyle.cls}`}>
                      {diffStyle.label}
                    </span>
                    {(problem.tags || []).map(tag => (
                      <span key={tag} className="text-xs text-slate-400 bg-slate-800 px-2.5 py-0.5 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <hr className="border-slate-800" />

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                      Challenge
                    </p>
                    {
}
                    <div className="text-sm text-slate-300 leading-relaxed space-y-3
                      [&_p]:my-2
                      [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1
                      [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1
                      [&_h1]:text-base [&_h1]:font-semibold [&_h1]:text-slate-100 [&_h1]:mt-4
                      [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-slate-100 [&_h2]:mt-4
                      [&_h3]:text-sm [&_h3]:font-medium [&_h3]:text-slate-200 [&_h3]:mt-3
                      [&_strong]:text-slate-100 [&_strong]:font-semibold
                      [&_a]:text-indigo-400 [&_a]:underline
                      [&_code]:bg-slate-800 [&_code]:text-slate-100 [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[12px]
                      [&_pre]:bg-slate-950 [&_pre]:border [&_pre]:border-slate-800 [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:overflow-x-auto
                      [&_pre_code]:bg-transparent [&_pre_code]:p-0
                      [&_blockquote]:border-l-2 [&_blockquote]:border-slate-700 [&_blockquote]:pl-3 [&_blockquote]:text-slate-400
                      [&_table]:w-full [&_table]:text-xs [&_table]:border-collapse
                      [&_th]:border [&_th]:border-slate-800 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left
                      [&_td]:border [&_td]:border-slate-800 [&_td]:px-2 [&_td]:py-1">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {problem.description}
                      </ReactMarkdown>
                    </div>
                  </div>
                </>
              )}

              {visibleTCs.length > 0 && (
                <>
                  <hr className="border-slate-800" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                      Examples
                    </p>
                    <div className="space-y-3">
                      {visibleTCs.slice(0, 2).map((tc, i) => (
                        <div key={tc.id ?? i} className="rounded-lg bg-slate-900 border border-slate-800 px-4 py-3 space-y-2">
                          <p className="text-[11px] font-medium text-slate-400">Example {i + 1}</p>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-slate-600 mb-1">Input</p>
                            <pre className="text-sm text-slate-200 font-mono whitespace-pre-wrap">{tc.input}</pre>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-slate-600 mb-1">Output</p>
                            <pre className="text-sm text-emerald-400 font-mono whitespace-pre-wrap">{tc.expectedOutput}</pre>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div className="pt-1 text-xs text-slate-600 flex gap-5">
                <span>{problem.totalSubmissions ?? 0} submissions</span>
                <span>
                  {problem.acceptanceRate?.toFixed
                    ? `${problem.acceptanceRate.toFixed(1)}%`
                    : `${problem.acceptanceRate ?? 0}%`}{' '}
                  acceptance
                </span>
              </div>
            </>
          )}

          {activeTab === 'Submissions' && (
            <div className="space-y-3">
              {!submission ? (
                <p className="text-sm text-slate-500">No submissions yet in this session.</p>
              ) : (
                <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-semibold ${statusColor}`}>
                      {submission.status.replace(/_/g, ' ').toUpperCase()}
                    </span>
                    <span className="text-xs text-slate-500">
                      {submission.passedTests}/{submission.totalTests} passed · {submission.runtime}ms
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 font-mono">
                    {language.toUpperCase()}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">

        <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-1">
            {languages.map(({ id: lang, label }) => (
              <button
                key={lang}
                onClick={() => handleLanguageChange(lang)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  language === lang
                    ? 'bg-slate-700 text-slate-50'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-4 py-1.5 rounded-md bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-400 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting && (
              <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            )}
            {isSubmitting ? 'Running…' : 'Run Code'}
          </button>
        </div>

        <div className="flex-1 overflow-hidden">
          <Editor
            height="100%"
            language={language}
            value={code}
            theme="vs-dark"
            onChange={(val) => setCode(val ?? '')}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              scrollBeyondLastLine: false,
              padding: { top: 14, bottom: 14 },
              lineDecorationsWidth: 4,
            }}
          />
        </div>

        <div className="shrink-0 h-72 flex flex-col border-t border-slate-800 bg-slate-950">
          <div className="flex items-center gap-4 px-4 py-2 border-b border-slate-800 shrink-0">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Output
            </span>
            {submission && (
              <>
                <span className={`text-xs font-semibold ${statusColor}`}>
                  {submission.status.replace(/_/g, ' ').toUpperCase()}
                </span>
                <span className="ml-auto text-xs text-slate-500">
                  {submission.passedTests}/{submission.totalTests} passed · {submission.runtime}ms
                </span>
              </>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 font-mono text-xs space-y-1.5">
            {!submission && (
              <span className="text-slate-600">Run your code to see results here.</span>
            )}

            {submission && testResults.map((tr, i) => {
              const showDiff =
                !tr.passed && tr.expectedOutput !== '[Hidden]' && tr.userOutput !== '[Hidden]';

              return (
                <div key={tr.testCaseId ?? i} className="space-y-1">
                  <div
                    className={`flex items-start gap-2 ${tr.passed ? 'text-emerald-400' : 'text-rose-400'}`}
                  >
                    <span className="shrink-0 select-none">{tr.passed ? '>>' : 'XX'}</span>
                    <span>
                      Test {i + 1}: {tr.passed ? 'Passed' : 'Failed'}
                      {tr.runtime != null && (
                        <span className="text-slate-600"> · {tr.runtime}ms</span>
                      )}
                      {tr.error && <span className="text-amber-400"> ({tr.error})</span>}
                    </span>
                  </div>

                  {showDiff && (
                    <div className="pl-6 pb-1">
                      <OutputDiff expected={tr.expectedOutput} actual={tr.userOutput} />
                    </div>
                  )}
                </div>
              );
            })}

            {submission && (
              <div className={`mt-1 ${submission.status === 'accepted' ? 'text-emerald-400' : 'text-slate-400'}`}>
                {submission.status === 'accepted'
                  ? `>> Everything OK! — ${submission.passedTests}/${submission.totalTests} tests passed (${submission.runtime}ms)`
                  : `>> ${submission.passedTests}/${submission.totalTests} tests passed`}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default ProblemDetailPage;
