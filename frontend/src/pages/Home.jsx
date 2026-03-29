import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';

const Home = () => {
  const { user } = useAuthStore();

  return (
    <div className="space-y-8">
      <section className="text-center space-y-4">
        <h1 className="text-3xl md:text-4xl font-bold text-slate-50">
          Practice coding interview problems.
        </h1>
        <p className="text-slate-300 max-w-2xl mx-auto">
          Solve algorithm problems,
          and track your progress over time.
        </p>

        <div className="flex justify-center gap-4 mt-4">
          {user ? (
            <Link
              to="/problems"
              className="px-5 py-2.5 rounded-md bg-indigo-500 text-white font-medium hover:bg-indigo-400"
            >
              Go to problems
            </Link>
          ) : (
            <>
              <Link
                to="/register"
                className="px-5 py-2.5 rounded-md bg-indigo-500 text-white font-medium hover:bg-indigo-400"
              >
                Get started
              </Link>
              <Link
                to="/login"
                className="px-5 py-2.5 rounded-md border border-slate-600 text-slate-200 font-medium hover:bg-slate-800"
              >
                Log in
              </Link>
            </>
          )}
        </div>
      </section>
    </div>
  );
};

export default Home;

