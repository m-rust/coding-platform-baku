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
    <div>
      <h2>Create your account</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

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
          {isSubmitting ? 'Creating account...' : 'Sign up'}
        </button>
      </form>

      <p>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
};

export default Register;

