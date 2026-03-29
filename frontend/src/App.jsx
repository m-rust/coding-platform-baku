import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
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

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col">
        <Navbar />
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/problems" element={<Problems />} />
              <Route path="/problems/new" element={<CreateProblemPage />} />
              <Route path="/problems/:id" element={<ProblemDetailPage />} />
              <Route path="/profile" element={<Profile />} />
            </Route>
          </Routes>
        </main>
        <Toaster position="top-right" />
      </div>
    </BrowserRouter>
  );
}

export default App;
