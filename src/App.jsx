import { NavLink, Route, Routes, useLocation, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Home from './routes/Home.jsx';
import About from './routes/About.jsx';
import Profile from './routes/Profile.jsx';
import SignIn from './routes/SignIn.jsx';
import SignUp from './routes/SignUp.jsx';
import Loader from './components/Loader.jsx';
import Dashboard from './routes/Dashboard.jsx';
import Sidebar from './components/Sidebar.jsx';
import Header from './components/Header.jsx';

const App = () => {
  const location = useLocation();
  const isAuthenticated = useSelector((state) => Boolean(state.user.name));
  const hideHeader = location.pathname === '/signin' || location.pathname === '/signup';

  // Don't show sidebar/header on signin/signup pages
  if (hideHeader) {
    return (
      <>
        <Loader />
        <Routes>
          <Route
            path="/"
            element={isAuthenticated ? <Home /> : <Navigate to="/signin" replace />}
          />
          <Route
            path="/dashboard"
            element={isAuthenticated ? <Dashboard /> : <Navigate to="/signin" replace />}
          />
          <Route
            path="/about"
            element={isAuthenticated ? <About /> : <Navigate to="/signin" replace />}
          />
          <Route
            path="/profile"
            element={isAuthenticated ? <Profile /> : <Navigate to="/signin" replace />}
          />
          <Route
            path="/signin"
            element={isAuthenticated ? <Navigate to="/" replace /> : <SignIn />}
          />
          <Route
            path="/signup"
            element={isAuthenticated ? <Navigate to="/" replace /> : <SignUp />}
          />
        </Routes>
      </>
    );
  }

  return (
    <div className="g-sidenav-show bg-gray-100">
      <Loader />
      <div className="min-height-300 bg-dark position-absolute w-100"></div>
      <Sidebar />
      <main className="main-content position-relative border-radius-lg">
        <Header />
        <Routes>
          <Route
            path="/"
            element={isAuthenticated ? <Home /> : <Navigate to="/signin" replace />}
          />
          <Route
            path="/dashboard"
            element={isAuthenticated ? <Dashboard /> : <Navigate to="/signin" replace />}
          />
          <Route
            path="/about"
            element={isAuthenticated ? <About /> : <Navigate to="/signin" replace />}
          />
          <Route
            path="/profile"
            element={isAuthenticated ? <Profile /> : <Navigate to="/signin" replace />}
          />
        </Routes>
      </main>
    </div>
  );
};

export default App;
