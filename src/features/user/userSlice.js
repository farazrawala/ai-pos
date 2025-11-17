import { createSlice } from '@reduxjs/toolkit';
// Example: createAsyncThunk could live here for server calls.

const getStoredUser = () => {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem('userData');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

const getStoredName = () => {
  const user = getStoredUser();
  return user?.name || '';
};

const getStoredToken = () => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('authToken') || '';
};

const initialState = {
  name: getStoredName(),
  token: getStoredToken(),
  user: getStoredUser(),
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
    setUser: (state, action) => {
      const userData = action.payload;
      state.user = userData;
      state.name = userData?.name || '';
      state.token = userData?.token || state.token;

      if (typeof window !== 'undefined') {
        if (userData) {
          // Save complete user data
          localStorage.setItem('userData', JSON.stringify(userData));
          // Also save name and token separately for backward compatibility
          if (userData.name) {
            localStorage.setItem('userName', userData.name);
          }
          if (userData.token) {
            localStorage.setItem('authToken', userData.token);
          }
        } else {
          localStorage.removeItem('userData');
          localStorage.removeItem('userName');
          localStorage.removeItem('authToken');
        }
      }
    },
    clearUser: (state) => {
      state.name = '';
      state.token = '';
      state.user = null;
      if (typeof window !== 'undefined') {
        localStorage.removeItem('userData');
        localStorage.removeItem('userName');
        localStorage.removeItem('authToken');
      }
    },
  },
});

export const { setName, setToken, setUser, clearUser } = userSlice.actions;
export default userSlice.reducer;
