import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { setName } from '../features/user/userSlice.js';
import PostList from '../components/PostList.jsx';

const Home = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleGreet = () => {
    dispatch(setName('Guest'));
    navigate('/profile');
  };

  return (
    <>
      <section className="card">
        <h2>Welcome</h2>
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

