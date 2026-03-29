import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api.js';
import { useAuthStore } from '../store/authStore.js';

const Register = () => {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await api.post('/auth/register', {
        name,
        email,
        password,
      });

      const { accessToken, refreshToken, user } = response.data;

      if (!accessToken || !refreshToken || !user) {
        throw new Error('Invalid registration response from server');
      }

      setAuth({ user, accessToken, refreshToken });
      toast.success('Account created');
      navigate('/problems', { replace: true });
    } catch (error) {
      const message =
        error.response?.data?.error || error.message || 'Registration failed';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-slate-900/80 border border-slate-800 rounded-xl p-6 shadow-lg">
      <h2 className="text-xl font-semibold text-slate-50 mb-4">
        Create your account
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-200 mb-1">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Jane Doe"
          />
        </div>

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
            minLength={6}
            className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="At least 6 characters"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full flex justify-center items-center px-4 py-2 rounded-md bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-400 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Creating account...' : 'Sign up'}
        </button>
      </form>

      <p className="mt-4 text-sm text-slate-400">
        Already have an account?{' '}
        <Link to="/login" className="text-indigo-400 hover:text-indigo-300">
          Log in
        </Link>
      </p>
    </div>
  );
};

export default Register;

