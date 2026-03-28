import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';

const Home = () => {
  const { user } = useAuthStore();

  return (
    <div>
      <section>
        <h1>Practice coding interview problems like LeetCode.</h1>
        <p>
          Solve algorithm problems, run your code in isolated Docker sandboxes,
          and track your progress over time.
        </p>

        <div>
          {user ? (
            <Link to="/problems">Go to problems</Link>
          ) : (
            <>
              <Link to="/register">Get started</Link>
              <Link to="/login">Log in</Link>
            </>
          )}
        </div>
      </section>
    </div>
  );
};

export default Home;

