import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { fetchPostsRequest, createPostRequest } from './postsAPI.js';

export const fetchPosts = createAsyncThunk('posts/fetchPosts', async () => {
  const { data } = await fetchPostsRequest();
  return data;
});

export const createPost = createAsyncThunk(
  'posts/createPost',
  async ({ title, body }) => {
    const { data } = await createPostRequest({ title, body });
    return data;
  }
);

const initialState = {
  status: 'idle',
  list: [],
  error: null
};

const postsSlice = createSlice({
  name: 'posts',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchPosts.pending, (state) => {
        state.status = 'pending';
        state.error = null;
      })
      .addCase(fetchPosts.fulfilled, (state, action) => {
        state.status = 'completed';
        state.list = action.payload;
      })
      .addCase(fetchPosts.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || 'Failed to fetch posts';
      })
      .addCase(createPost.pending, (state) => {
        state.status = 'pending';
        state.error = null;
      })
      .addCase(createPost.fulfilled, (state, action) => {
        state.status = 'completed';
        state.list = [action.payload, ...state.list];
      })
      .addCase(createPost.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || 'Failed to create post';
      });
  }
});

export default postsSlice.reducer;

