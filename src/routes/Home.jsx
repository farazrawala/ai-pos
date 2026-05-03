import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { setName, clearUser } from '../features/user/userSlice.js';
import PostList from '../components/PostList.jsx';

const Home = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleGreet = () => {
    dispatch(setName('Guest'));
    navigate('/profile');
  };

  const handleLogout = () => {
    dispatch(clearUser());
    navigate('/signin');
  };

  return (
    <>
      <section className="card">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
          <h2 className="mb-0">Welcome</h2>
          <button type="button" className="btn btn-outline-danger btn-sm" onClick={handleLogout}>
            Log out
          </button>
        </div>
        <p>Use the controls below to populate the Redux store.</p>
        <button type="button" onClick={handleGreet}>
          Continue as Guest
        </button>
      </section>
      <PostList />
    </>
  );
};

export default Home;

