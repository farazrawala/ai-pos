import apiClient from '../../api/apiClient.js';

export const fetchPostsRequest = () => apiClient.get('/posts');

export const createPostRequest = (data) =>
  apiClient.post('/posts', {
    title: data.title,
    body: data.body,
    userId: 1
  });

