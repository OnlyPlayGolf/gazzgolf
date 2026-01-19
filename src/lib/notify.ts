// Centralized notification API.
// Toast popups are intentionally disabled across the app.

type ToastFn = (message?: string) => void;

export const toast: {
  success: ToastFn;
  error: ToastFn;
  info: ToastFn;
  message: ToastFn;
  warning: ToastFn;
} = {
  success: () => {},
  error: () => {},
  info: () => {},
  message: () => {},
  warning: () => {},
};

