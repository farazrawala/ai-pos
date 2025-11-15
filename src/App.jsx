import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import Home from './routes/Home.jsx';
import About from './routes/About.jsx';
import Profile from './routes/Profile.jsx';
import SignIn from './routes/SignIn.jsx';
import SignUp from './routes/SignUp.jsx';
import Loader from './components/Loader.jsx';

const App = () => {
  const location = useLocation();
  const hideHeader = location.pathname === '/signin' || location.pathname === '/signup';

  return (
    <div className="app-shell">
      <Loader />
      {!hideHeader && (
        <header className="app-header">
          <h1>AI POS</h1>
          <nav>
            <NavLink to="/" end className="nav-link">
              Home
            </NavLink>
            <NavLink to="/about" className="nav-link">
              About
            </NavLink>
            <NavLink to="/profile" className="nav-link">
              Profile
            </NavLink>
            <NavLink to="/signin" className="nav-link">
              Sign In
            </NavLink>
            <NavLink to="/signup" className="nav-link">
              Sign Up
            </NavLink>
          </nav>
        </header>
      )}
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />
        </Routes>
      </main>
    </div>
  );
};

export default App;

