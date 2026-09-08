import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import api from './services/api.js';
import { useAuthStore } from './store/authStore.js';
import './App.css';
import Navbar from './components/common/Navbar.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Problems from './pages/Problems.jsx';
import ProblemDetailPage from './pages/ProblemDetailPage.jsx';
import CreateProblemPage from './pages/CreateProblemPage.jsx';
import Profile from './pages/Profile.jsx';
import ProtectedRoute from './components/common/ProtectedRoute.jsx';

const StandardLayout = () => (
  <main className="flex-1 overflow-y-auto">
    <div className="max-w-6xl w-full mx-auto px-4 py-6">
      <Outlet />
    </div>
  </main>
);

function App() {
  const isBootstrapped = useAuthStore((state) => state.isBootstrapped);

  useEffect(() => {
    if (isBootstrapped) return;

    const { user, setUser, clearAuth, completeBootstrap } = useAuthStore.getState();

    if (!user) {
      completeBootstrap();
      return;
    }

    api
      .get('/auth/me')
      .then((res) => setUser(res.data.user))
      .catch(() => clearAuth())
      .finally(() => completeBootstrap());
  }, [isBootstrapped]);

  return (
    <BrowserRouter>
      <div className="h-screen bg-slate-950 text-slate-50 flex flex-col overflow-hidden">
        <Navbar />
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/problems/:id" element={<ProblemDetailPage />} />
          </Route>

          <Route element={<StandardLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/problems" element={<Problems />} />
              <Route path="/problems/new" element={<CreateProblemPage />} />
              <Route path="/profile" element={<Profile />} />
            </Route>
          </Route>
        </Routes>
        <Toaster position="top-right" />
      </div>
    </BrowserRouter>
  );
}

export default App;
