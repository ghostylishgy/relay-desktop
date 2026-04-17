// components/Toast/index.tsx

import { useApp } from '../../context/AppContext';
import './Toast.css';

export function ToastContainer() {
  const { state, dispatch } = useApp();

  if (state.toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {state.toasts.map(toast => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          <span className="toast-message">{toast.message}</span>
          <button
            className="toast-close"
            onClick={() => dispatch({ type: 'REMOVE_TOAST', payload: toast.id })}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
