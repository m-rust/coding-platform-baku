import { Link } from 'react-router-dom';

const difficultyColors = {
  easy: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/40',
  medium: 'text-amber-400 bg-amber-500/10 border-amber-500/40',
  hard: 'text-rose-400 bg-rose-500/10 border-rose-500/40',
};

const ProblemCard = ({ problem }) => {
  const difficulty = problem.difficulty?.toLowerCase() || 'easy';
  const diffClass = difficultyColors[difficulty] || difficultyColors.easy;

  return (
    <Link
      to={`/problems/${problem.id}`}
      className="block rounded-lg border border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900 transition-colors p-4"
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium text-slate-50">{problem.title}</h3>
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${diffClass}`}
        >
          {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
        </span>
      </div>
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>By {problem.createdBy}</span>
        <span>
          {problem.acceptanceRate?.toFixed
            ? `${problem.acceptanceRate.toFixed(1)}%`
            : `${problem.acceptanceRate ?? 0}%`}{' '}
          acceptance
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {problem.tags?.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300"
          >
            {tag}
          </span>
        ))}
        {problem.tags?.length > 3 && (
          <span className="text-[11px] text-slate-400">
            +{problem.tags.length - 3} more
          </span>
        )}
      </div>
    </Link>
  );
};

export default ProblemCard;

