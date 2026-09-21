import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore.js';
import api from '../../services/api.js';
import toast from 'react-hot-toast';

const Navbar = () => {
  const navigate = useNavigate();
  const { user, clearAuth } = useAuthStore();
  const isAuthenticated = Boolean(user);

  const handleLogout = async () => {
    await api.post('/auth/logout').catch(() => null);

    clearAuth();
    toast.success('Logged out');
    navigate('/');
  };

  const linkClass = ({ isActive }) =>
    `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
      isActive
        ? 'bg-white/10 text-white'
        : 'text-[#b7c9cc] hover:text-white hover:bg-white/10'
    }`;

  return (
    <header className="bg-[#0e141e]">
      <nav className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="h-8 w-8 rounded bg-indigo-500 flex items-center justify-center text-sm font-bold text-white">
              BK
            </span>
            <span className="font-semibold text-white">
              Baku
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {isAuthenticated && (
            <>
              <NavLink to="/problems" className={linkClass}>
                Problems
              </NavLink>
              <NavLink to="/profile" className={linkClass}>
                Profile
              </NavLink>
            </>
          )}

          {!isAuthenticated ? (
            <>
              <Link
                to="/"
                className="px-3 py-1.5 text-sm font-medium text-[#b7c9cc] hover:text-white"
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
              className="px-3 py-1.5 text-sm font-medium rounded-md border border-white/30 text-white hover:bg-white/10"
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

