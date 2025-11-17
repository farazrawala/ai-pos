import { createSlice } from '@reduxjs/toolkit';
// Example: createAsyncThunk could live here for server calls.

const getStoredName = () => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('userName') || '';
};

const getStoredToken = () => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('authToken') || '';
};

const initialState = {
  name: getStoredName(),
  token: getStoredToken(),
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setName: (state, action) => {
      state.name = action.payload;
      if (typeof window !== 'undefined') {
        if (action.payload) {
          localStorage.setItem('userName', action.payload);
        } else {
          localStorage.removeItem('userName');
        }
      }
    },
    setToken: (state, action) => {
      state.token = action.payload;
      if (typeof window !== 'undefined') {
        if (action.payload) {
          localStorage.setItem('authToken', action.payload);
        } else {
          localStorage.removeItem('authToken');
        }
      }
    },
    clearUser: (state) => {
      state.name = '';
      state.token = '';
      if (typeof window !== 'undefined') {
        localStorage.removeItem('userName');
        localStorage.removeItem('authToken');
      }
    },
  },
});

export const { setName, setToken, clearUser } = userSlice.actions;
export default userSlice.reducer;
