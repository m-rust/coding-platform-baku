import { useEffect, useState } from 'react';
import api from '../services/api.js';
import LoadingSpinner from '../components/common/LoadingSpinner.jsx';

const Profile = () => {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchStats = async () => {
      setIsLoading(true);
      setError('');
      try {
        const response = await api.get('/users/me/stats');
        setStats(response.data);
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

  const { user, statistics, problemsByDifficulty, languageStats } = stats;

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
    </div>
  );
};

export default Profile;

