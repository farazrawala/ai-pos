import { useDispatch, useSelector } from 'react-redux';
import { setName } from './userSlice.js';

const UserProfile = () => {
  const dispatch = useDispatch();
  const name = useSelector((state) => state.user.name);

  const handleReset = () => {
    dispatch(setName(''));
  };

  return (
    <div className="profile-card">
      <p>
        Signed in as: <strong>{name}</strong>
      </p>
      <button type="button" onClick={handleReset}>
        Reset Name
      </button>
    </div>
  );
};

export default UserProfile;

