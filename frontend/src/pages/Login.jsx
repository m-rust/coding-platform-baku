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
    <div className="max-w-md mx-auto bg-slate-900/80 border border-slate-800 rounded-xl p-6 shadow-lg">
      <h2 className="text-xl font-semibold text-slate-50 mb-4">
        Log in to your account
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-200 mb-1">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-200 mb-1">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="••••••••"
            minLength={6}
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full flex justify-center items-center px-4 py-2 rounded-md bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-400 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Logging in...' : 'Log in'}
        </button>
      </form>

      <p className="mt-4 text-sm text-slate-400">
        Don&apos;t have an account?{' '}
        <Link to="/register" className="text-indigo-400 hover:text-indigo-300">
          Sign up
        </Link>
      </p>
    </div>
  );
};

export default Login;

