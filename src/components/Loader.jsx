import { useSelector } from 'react-redux';

const Loader = () => {
  const isLoading = useSelector((state) => state.loader.isLoading);

  if (!isLoading) return null;

  return (
    <div className="loader-overlay">
      <div className="loader-spinner" />
      <p>Loading...</p>
    </div>
  );
};

export default Loader;

