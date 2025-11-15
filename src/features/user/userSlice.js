import { createSlice } from '@reduxjs/toolkit';
// Example: createAsyncThunk could live here for server calls.

const initialState = {
  name: ''
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setName: (state, action) => {
      state.name = action.payload;
    }
  }
});

export const { setName } = userSlice.actions;
export default userSlice.reducer;

