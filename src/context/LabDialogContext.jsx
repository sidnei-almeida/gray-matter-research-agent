import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import LabConfirmDialog from '../components/LabConfirmDialog';

const LabDialogContext = createContext(null);

export function LabDialogProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const resolveRef = useRef(null);

  const confirm = useCallback((options = {}) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setDialog({ variant: 'default', ...options });
    });
  }, []);

  const settle = useCallback((result) => {
    resolveRef.current?.(result);
    resolveRef.current = null;
    setDialog(null);
  }, []);

  useEffect(() => {
    if (!dialog) return undefined;

    const onKeyDown = (e) => {
      if (e.key === 'Escape') settle(false);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [dialog, settle]);

  return (
    <LabDialogContext.Provider value={{ confirm }}>
      {children}
      {dialog &&
        createPortal(
          <LabConfirmDialog
            title={dialog.title}
            description={dialog.description}
            confirmLabel={dialog.confirmLabel}
            cancelLabel={dialog.cancelLabel}
            variant={dialog.variant}
            onCancel={() => settle(false)}
            onConfirm={() => settle(true)}
          />,
          document.body
        )}
    </LabDialogContext.Provider>
  );
}

export function useLabDialog() {
  const ctx = useContext(LabDialogContext);
  if (!ctx) {
    throw new Error('useLabDialog must be used within LabDialogProvider');
  }
  return ctx;
}
