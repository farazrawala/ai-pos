import { FaHeart } from 'react-icons/fa6';
import NavIcon from './NavIcon.jsx';
import { APP_NAME } from '../config/env.js';

const Footer = () => {
  return (
    <footer className="footer pt-3">
      <div className="container-fluid">
        <div className="row align-items-center justify-content-lg-between">
          <div className="col-lg-12 mb-lg-0 mb-4">
            <div className="copyright text-center text-sm text-muted">
              © {new Date().getFullYear()}, made with{' '}
              <NavIcon icon={FaHeart} className="text-danger mx-1" size={14} /> by {APP_NAME}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
