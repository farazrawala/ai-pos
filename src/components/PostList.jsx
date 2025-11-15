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
      <header className="card-header">
        <div>
          <h2>Posts</h2>
          <p className="muted">Status: {status}</p>
        </div>
      </header>

      <form className="post-form" onSubmit={handleSubmit}>
        <input
          type="text"
          name="title"
          placeholder="Post title"
          value={form.title}
          onChange={handleChange}
          required
        />
        <textarea
          name="body"
          placeholder="Write something..."
          rows="3"
          value={form.body}
          onChange={handleChange}
          required
        />
        <button type="submit" disabled={status === 'pending'}>
          {status === 'pending' ? 'Saving...' : 'Add Post'}
        </button>
      </form>

      {error && <p className="error">Error: {error}</p>}

      <ul className="post-list">
        {list.map((post) => (
          <li key={post.id}>
            <h3>{post.title}</h3>
            <p>{post.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default PostList;

