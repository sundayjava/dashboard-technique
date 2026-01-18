import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

/**
 * Auth Store State Interface
 */
interface AuthState {
  user: {
    id: string;
    email: string;
    name: string;
  } | null;
  token: string | null;
  isAuthenticated: boolean;
}

/**
 * Auth Store Actions Interface
 */
interface AuthActions {
  setUser: (user: AuthState["user"]) => void;
  setToken: (token: string) => void;
  login: (user: AuthState["user"], token: string) => void;
  logout: () => void;
  clearAuth: () => void;
}

/**
 * Auth Store Type
 */
type AuthStore = AuthState & AuthActions;

/**
 * Initial State
 */
const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
};

/**
 * Auth Store
 * Manages authentication state with persistence
 */
export const useAuthStore = create<AuthStore>()(
  devtools(
    persist(
      (set) => ({
        ...initialState,

        setUser: (user) =>
          set({ user, isAuthenticated: !!user }, false, "setUser"),

        setToken: (token) =>
          set({ token }, false, "setToken"),

        login: (user, token) =>
          set(
            { user, token, isAuthenticated: true },
            false,
            "login"
          ),

        logout: () =>
          set(
            { ...initialState },
            false,
            "logout"
          ),

        clearAuth: () =>
          set(
            { ...initialState },
            false,
            "clearAuth"
          ),
      }),
      {
        name: "auth-storage",
        partialize: (state) => ({
          user: state.user,
          token: state.token,
          isAuthenticated: state.isAuthenticated,
        }),
      }
    ),
    { name: "AuthStore" }
  )
);
