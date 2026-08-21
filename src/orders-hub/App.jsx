import { Navigate, Route, Routes } from 'react-router-dom';
import Home from './pages/Home.jsx';
import { SignupModalProvider } from './context/SignupModalContext.jsx';
import SignupModal from './components/SignupModal/SignupModal.jsx';

export default function App() {
  return (
    <SignupModalProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <SignupModal />
    </SignupModalProvider>
  );
}
