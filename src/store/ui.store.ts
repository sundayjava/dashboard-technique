import { create } from "zustand";
import { devtools } from "zustand/middleware";

/**
 * UI Store State Interface
 */
interface UIState {
  isSidebarOpen: boolean;
  isModalOpen: boolean;
  modalContent: React.ReactNode | null;
  theme: "light" | "dark" | "system";
  selectedService: string | null;
}

/**
 * UI Store Actions Interface
 */
interface UIActions {
  toggleSidebar: () => void;
  setSidebarOpen: (isOpen: boolean) => void;
  openModal: (content: React.ReactNode) => void;
  closeModal: () => void;
  setTheme: (theme: UIState["theme"]) => void;
  setSelectedService: (service: string | null) => void;
}

/**
 * UI Store Type
 */
type UIStore = UIState & UIActions;

/**
 * Initial State
 */
const initialState: UIState = {
  isSidebarOpen: true,
  isModalOpen: false,
  modalContent: null,
  theme: "system",
  selectedService: null,
};

/**
 * UI Store
 * Manages UI state like sidebar, modals, theme
 */
export const useUIStore = create<UIStore>()(
  devtools(
    (set) => ({
      ...initialState,

      toggleSidebar: () =>
        set(
          (state) => ({ isSidebarOpen: !state.isSidebarOpen }),
          false,
          "toggleSidebar"
        ),

      setSidebarOpen: (isOpen) =>
        set({ isSidebarOpen: isOpen }, false, "setSidebarOpen"),

      openModal: (content) =>
        set(
          { isModalOpen: true, modalContent: content },
          false,
          "openModal"
        ),

      closeModal: () =>
        set(
          { isModalOpen: false, modalContent: null },
          false,
          "closeModal"
        ),

      setTheme: (theme) =>
        set({ theme }, false, "setTheme"),

      setSelectedService: (service) =>
        set({ selectedService: service }, false, "setSelectedService"),
    }),
    { name: "UIStore" }
  )
);
