import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { User } from "../types";
import { restoreUserFromSession } from "../utils/authSession";

interface AuthState {
    user: User | null;
    /** True while a Clerk session is being synced to a backend JWT. */
    clerkSyncing: boolean;
}

const initialState: AuthState = {
    user: restoreUserFromSession(),
    clerkSyncing: false,
};

const authSlice = createSlice({
    name: "auth",
    initialState,
    reducers: {
        setUser(state, action: PayloadAction<User | null>) {
            state.user = action.payload;
        },
        clearUser(state) {
            state.user = null;
        },
        setClerkSyncing(state, action: PayloadAction<boolean>) {
            state.clerkSyncing = action.payload;
        },
    },
});

export const { setUser, clearUser, setClerkSyncing } = authSlice.actions;
export default authSlice.reducer;
