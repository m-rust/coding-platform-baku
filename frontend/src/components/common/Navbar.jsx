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

  return (
    <header>
      <nav>
        <div>
          <Link to="/">
            <span>LC</span>
            <span>CodePlatform</span>
          </Link>
        </div>

        <div>
          {isAuthenticated && (
            <>
              <NavLink to="/problems">Problems</NavLink>
              <NavLink to="/problems/new">Create problem</NavLink>
              <NavLink to="/profile">Profile</NavLink>
            </>
          )}

          {!isAuthenticated ? (
            <>
              <Link to="/login">Log in</Link>
              <Link to="/register">Sign up</Link>
            </>
          ) : (
            <button type="button" onClick={handleLogout}>
              Logout
            </button>
          )}
        </div>
      </nav>
    </header>
  );
};

export default Navbar;

