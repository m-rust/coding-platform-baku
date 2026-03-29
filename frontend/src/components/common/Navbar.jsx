import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore.js';
import api from '../../services/api.js';
import toast from 'react-hot-toast';

const Navbar = () => {
  const navigate = useNavigate();
  const { user, refreshToken, clearAuth } = useAuthStore();
  const isAuthenticated = Boolean(user);

  const handleLogout = async () => {
    try {
      if (refreshToken) {
        await api.post('/auth/logout', { refreshToken });
      }
    } catch {
      // ignore logout errors
    } finally {
      clearAuth();
      toast.success('Logged out');
      navigate('/login');
    }
  };

  const linkClass = ({ isActive }) =>
    `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
      isActive
        ? 'bg-slate-800 text-white'
        : 'text-slate-300 hover:text-white hover:bg-slate-800'
    }`;

  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
      <nav className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="h-8 w-8 rounded bg-indigo-500 flex items-center justify-center text-sm font-bold">
              LC
            </span>
            <span className="font-semibold text-slate-50">
              CodePlatform
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {isAuthenticated && (
            <>
              <NavLink to="/problems" className={linkClass}>
                Problems
              </NavLink>
              <NavLink to="/problems/new" className={linkClass}>
                Create problem
              </NavLink>
              <NavLink to="/profile" className={linkClass}>
                Profile
              </NavLink>
            </>
          )}

          {!isAuthenticated ? (
            <>
              <Link
                to="/login"
                className="px-3 py-1.5 text-sm font-medium text-slate-200 hover:text-white"
              >
                Log in
              </Link>
              <Link
                to="/register"
                className="px-3 py-1.5 text-sm font-medium rounded-md bg-indigo-500 text-white hover:bg-indigo-400"
              >
                Sign up
              </Link>
            </>
          ) : (
            <button
              type="button"
              onClick={handleLogout}
              className="px-3 py-1.5 text-sm font-medium rounded-md border border-slate-600 text-slate-200 hover:bg-slate-800"
            >
              Logout
            </button>
          )}
        </div>
      </nav>
    </header>
  );
};

export default Navbar;

