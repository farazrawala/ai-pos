import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchPosts, createPost } from '../features/posts/postsSlice.js';

const initialFormState = { title: '', body: '' };

const PostList = () => {
  const dispatch = useDispatch();
  const { list, status, error } = useSelector((state) => state.posts);
  const [form, setForm] = useState(initialFormState);

  useEffect(() => {
    if (status === 'idle') {
      dispatch(fetchPosts());
    }
  }, [dispatch, status]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.body.trim()) return;
    dispatch(createPost(form)).then((action) => {
      if (action.meta.requestStatus === 'fulfilled') {
        setForm(initialFormState);
      }
    });
  };

  return (
    <section className="card">
      <header className="card-header d-flex align-items-center justify-content-between mb-3">
        <div>
          <h2>Posts</h2>
          <p className="muted">Status: {status}</p>
        </div>
      </header>

      {error && <p className="error">Error: {error}</p>}
    </section>
  );
};

export default PostList;
