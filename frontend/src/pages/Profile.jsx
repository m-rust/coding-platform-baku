import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api.js';
import LoadingSpinner from '../components/common/LoadingSpinner.jsx';

const TABS = ['Solved', 'Submissions', 'Created'];

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const UNITS = [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60]];

const timeAgo = (date) => {
  const secs = (new Date(date) - Date.now()) / 1000;
  const [unit, size] = UNITS.find(([, n]) => Math.abs(secs) >= n) || ['second', 1];
  return rtf.format(Math.round(secs / size), unit);
};

const statusColor = (status) =>
  status === 'accepted' ? 'text-emerald-400' : status === 'pending' ? 'text-amber-400' : 'text-rose-400';

const Profile = () => {
  const [activeTab, setActiveTab] = useState('Solved');
  const [solved, setSolved] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchStats = async () => {
      setIsLoading(true);
      setError('');
      try {
        const [statsRes, progressRes, submissionsRes] = await Promise.all([
          api.get('/users/me/stats'),
          api.get('/users/me/progress', { params: { status: 'solved' } }),
          api.get('/submissions', { params: { limit: 50 } }),
        ]);
        setStats(statsRes.data);
        setSolved(
          [...progressRes.data.progress].sort(
            (a, b) => new Date(b.solvedAt ?? b.lastAttemptedAt) - new Date(a.solvedAt ?? a.lastAttemptedAt)
          )
        );
        setSubmissions(submissionsRes.data.submissions);
      } catch (err) {
        const message =
          err.response?.data?.error ||
          err.message ||
          'Failed to load stats';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (isLoading) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="text-sm text-rose-400">
        Failed to load profile: {error}
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const { user, statistics, problemsByDifficulty, languageStats, createdProblems = [] } = stats;

  const rows = {
    Solved: solved.map((p) => ({
      key: p.problemId,
      problemId: p.problemId,
      title: p.problemTitle,
      when: p.solvedAt ?? p.lastAttemptedAt,
    })),
    Submissions: submissions.map((s) => ({
      key: s.id,
      problemId: s.problemId,
      title: s.problemTitle,
      when: s.submittedAt,
      extra: (
        <span className={`text-xs font-medium ${statusColor(s.status)}`}>
          {s.status.replace(/_/g, ' ')} · {s.language}
        </span>
      ),
    })),
    Created: createdProblems.map((p) => ({
      key: p.id,
      problemId: p.id,
      title: p.title,
      when: p.createdAt,
      extra: <span className="text-xs text-slate-400 capitalize">{p.difficulty}</span>,
    })),
  }[activeTab];

  return (
    <div className="space-y-6">
      <section className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-50">
            {user.name || user.email}
          </h2>
          <p className="text-sm text-slate-400">{user.email}</p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
          <div className="text-xs text-slate-400 mb-1">Total submissions</div>
          <div className="text-2xl font-semibold text-slate-50">
            {statistics.totalSubmissions}
          </div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
          <div className="text-xs text-slate-400 mb-1">Acceptance rate</div>
          <div className="text-2xl font-semibold text-emerald-400">
            {statistics.acceptanceRate.toFixed
              ? `${statistics.acceptanceRate.toFixed(1)}%`
              : `${statistics.acceptanceRate}%`}
          </div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
          <div className="text-xs text-slate-400 mb-1">Problems solved</div>
          <div className="text-2xl font-semibold text-indigo-400">
            {statistics.problemsSolved}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
          <h3 className="text-sm font-medium text-slate-100 mb-2">
            Solved by difficulty
          </h3>
          <ul className="space-y-1 text-sm text-slate-300">
            <li>Easy: {problemsByDifficulty.easy}</li>
            <li>Medium: {problemsByDifficulty.medium}</li>
            <li>Hard: {problemsByDifficulty.hard}</li>
          </ul>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
          <h3 className="text-sm font-medium text-slate-100 mb-2">
            Submissions by language
          </h3>
          <ul className="space-y-1 text-sm text-slate-300">
            <li>Python: {languageStats.python}</li>
            <li>C++: {languageStats.cpp}</li>
          </ul>
        </div>
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
        <div className="flex gap-2 mb-3">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-slate-800 text-slate-50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {rows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">Nothing here yet.</p>
        ) : (
          <ul>
            {rows.map((row, i) => (
              <li key={row.key}>
                <Link
                  to={`/problems/${row.problemId}`}
                  className={`flex items-center justify-between gap-4 px-4 py-3 rounded-md hover:bg-slate-700/50 ${
                    i % 2 === 0 ? 'bg-slate-800/60' : ''
                  }`}
                >
                  <span className="text-sm text-slate-100 truncate">{row.title}</span>
                  <span className="flex shrink-0 items-center gap-4">
                    {row.extra}
                    <span className="text-sm text-slate-400">{timeAgo(row.when)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default Profile;

