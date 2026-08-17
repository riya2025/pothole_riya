import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { User } from "../types";
import { isGuestMode, enableGuestMode, disableGuestMode, restoreUserFromSession } from "../utils/authSession";

interface AuthState {
    user: User | null;
    /** True while a Clerk session is being synced to a backend JWT. */
    clerkSyncing: boolean;
    /** Browsing without an account (session-only). */
    isGuest: boolean;
}

const initialState: AuthState = {
    user: restoreUserFromSession(),
    clerkSyncing: false,
    isGuest: isGuestMode(),
};

const authSlice = createSlice({
    name: "auth",
    initialState,
    reducers: {
        setUser(state, action: PayloadAction<User | null>) {
            state.user = action.payload;
            if (action.payload) {
                state.isGuest = false;
                disableGuestMode();
            }
        },
        clearUser(state) {
            state.user = null;
        },
        enterGuestMode(state) {
            state.isGuest = true;
            enableGuestMode();
        },
        exitGuestMode(state) {
            state.isGuest = false;
            disableGuestMode();
        },
        setClerkSyncing(state, action: PayloadAction<boolean>) {
            state.clerkSyncing = action.payload;
        },
    },
});

export const { setUser, clearUser, setClerkSyncing, enterGuestMode, exitGuestMode } = authSlice.actions;
export default authSlice.reducer;
