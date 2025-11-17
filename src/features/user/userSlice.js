import { createSlice } from '@reduxjs/toolkit';
// Example: createAsyncThunk could live here for server calls.

const getStoredName = () => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('userName') || '';
};

const initialState = {
  name: getStoredName()
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
    clearUser: (state) => {
      state.name = '';
      if (typeof window !== 'undefined') {
        localStorage.removeItem('userName');
      }
    }
  }
});

export const { setName, clearUser } = userSlice.actions;
export default userSlice.reducer;

