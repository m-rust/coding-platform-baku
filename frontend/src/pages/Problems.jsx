import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api.js';
import LoadingSpinner from '../components/common/LoadingSpinner.jsx';
import ProblemCard from '../components/problems/ProblemCard.jsx';

const DIFFICULTIES = [
  { value: '', label: 'All' },
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

const LIMIT = 20;

const Problems = () => {
  const [problems, setProblems] = useState([]);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    hasMore: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);

  const fetchProblems = useCallback(
    async (page = 1, append = false) => {
      if (page === 1) setIsLoading(true);
      else setIsLoadingMore(true);
      setError('');
      try {
        const params = new URLSearchParams();
        if (search.trim()) params.set('search', search.trim());
        if (difficulty) params.set('difficulty', difficulty);
        selectedTags.forEach((t) => params.append('tags', t));

        params.set('page', String(page));
        params.set('limit', String(LIMIT));

        const response = await api.get(`/problems?${params.toString()}`);
        const list = response.data.problems || [];
        const pag = response.data.pagination || {};

        setProblems((prev) => (append ? [...prev, ...list] : list));
        setPagination({
          currentPage: pag.currentPage ?? page,
          totalPages: pag.totalPages ?? 1,
          totalCount: pag.totalCount ?? 0,
          hasMore: pag.hasMore ?? false,
        });
      } catch (err) {
        const message =
          err.response?.data?.error || err.message || 'Failed to load problems';
        setError(message);
        if (!append) setProblems([]);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [search, difficulty, selectedTags]
  );

  useEffect(() => {
    const loadTags = async () => {
      try {
        const res = await api.get('/problems/tags/list');
        setAvailableTags(res.data?.tags ?? []);
      } catch {
        setAvailableTags([]);
      }
    };
    loadTags();
  }, []);

  useEffect(() => {
    fetchProblems(1, false);
  }, [fetchProblems]);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const toggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  const loadMore = () => {
    if (pagination.hasMore && !isLoadingMore) {
      fetchProblems(pagination.currentPage + 1, true);
    }
  };

  if (isLoading && problems.length === 0) {
    return <LoadingSpinner />;
  }

  if (error && problems.length === 0) {
    return (
      <div className="text-center text-sm text-rose-400">
        Failed to load problems: {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-50">Problems</h2>
        <Link
          to="/problems/new"
          className="px-3 py-1.5 rounded-md text-sm font-medium bg-indigo-500 text-white hover:bg-indigo-400 w-fit"
        >
          Create problem
        </Link>
      </div>

      <div className="space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by title or description..."
            className="flex-1 min-w-0 rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            className="px-3 py-2 rounded-md text-sm font-medium bg-slate-700 text-slate-200 hover:bg-slate-600"
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-400">Difficulty:</span>
          {DIFFICULTIES.map((d) => (
            <button
              key={d.value || 'all'}
              type="button"
              onClick={() => setDifficulty(d.value)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                difficulty === d.value
                  ? 'bg-indigo-500 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-slate-50'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
        {availableTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-slate-400">Tags:</span>
            {availableTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  selectedTags.includes(tag)
                    ? 'bg-indigo-500 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-slate-50'
                }`}
              >
                {tag}
              </button>
            ))}
            {selectedTags.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedTags([])}
                className="text-xs text-slate-500 hover:text-slate-300"
              >
                Clear tags
              </button>
            )}
          </div>
        )}
      </div>

      {isLoading && problems.length === 0 ? (
        <LoadingSpinner />
      ) : problems.length === 0 ? (
        <p className="text-sm text-slate-400">
          No problems found. Try different search or filters, or create one using
          the button above.
        </p>
      ) : (
        <>
          {(isLoading || pagination.totalCount > 0) && (
            <p className="text-xs text-slate-500">
              {isLoading ? (
                'Updating...'
              ) : (
                <>Showing {problems.length} of {pagination.totalCount} problems</>
              )}
            </p>
          )}
          <div className="grid gap-3">
            {problems.map((problem) => (
              <ProblemCard key={problem.id} problem={problem} />
            ))}
          </div>
          {pagination.hasMore && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={loadMore}
                disabled={isLoadingMore}
                className="px-4 py-2 rounded-md text-sm font-medium bg-slate-700 text-slate-200 hover:bg-slate-600 disabled:opacity-60"
              >
                {isLoadingMore ? 'Loading...' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Problems;

