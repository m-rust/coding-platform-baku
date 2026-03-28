import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api.js';
import { useAuthStore } from '../store/authStore.js';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setAuth } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const from = location.state?.from || '/problems';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await api.post('/auth/login', {
        email,
        password,
      });

      const { accessToken, refreshToken, user } = response.data;

      if (!accessToken || !refreshToken || !user) {
        throw new Error('Invalid login response from server');
      }

      setAuth({ user, accessToken, refreshToken });
      toast.success('Logged in successfully');
      navigate(from, { replace: true });
    } catch (error) {
      const message =
        error.response?.data?.error || error.message || 'Login failed';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <h2>Log in to your account</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div>
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Logging in...' : 'Log in'}
        </button>
      </form>

      <p>
        Don&apos;t have an account? <Link to="/register">Sign up</Link>
      </p>
    </div>
  );
};

export default Login;

