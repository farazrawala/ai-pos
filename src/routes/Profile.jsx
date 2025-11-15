import { NavLink } from 'react-router-dom';
import { useSelector } from 'react-redux';
import UserProfile from '../features/user/UserProfile.jsx';

const Profile = () => {
  const name = useSelector((state) => state.user.name);

  if (!name) {
    return (
      <section className="card">
        <h2>No profile info yet</h2>
        <p>Head back home and pick a name to populate the store.</p>
        <NavLink to="/" className="text-link">
          Go to Home
        </NavLink>
      </section>
    );
  }

  return (
    <section className="card">
      <h2>Profile</h2>
      <UserProfile />
    </section>
  );
};

export default Profile;

