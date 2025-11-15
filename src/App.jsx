import { NavLink, Route, Routes } from 'react-router-dom';
import Home from './routes/Home.jsx';
import About from './routes/About.jsx';
import Profile from './routes/Profile.jsx';

const App = () => (
  <div className="app-shell">
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
      </nav>
    </header>
    <main className="app-main">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
    </main>
  </div>
);

export default App;

