import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore.js';

const ProtectedRoute = () => {
  const location = useLocation();
  const { user, accessToken } = useAuthStore();

  const isAuthenticated = Boolean(user) && Boolean(accessToken);

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  return <Outlet />;
};

export default ProtectedRoute;

