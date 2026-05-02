import { NavLink } from 'react-router-dom';
import { useSelector } from 'react-redux';
import UserProfile from '../features/user/UserProfile.jsx';

const Profile = () => {
  const { name, user } = useSelector((state) => state.user);
  const hasSession = Boolean(name || user?.name || user?.email || user?._id);

  if (!hasSession) {
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
