import { useEffect, useRef } from 'react';
import { AlertTriangle, FlaskConical } from 'lucide-react';

export default function LabConfirmDialog({
  title = 'Confirm lab action',
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onCancel,
  onConfirm,
}) {
  const cancelRef = useRef(null);
  const isDanger = variant === 'danger';

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  return (
    <div className="lab-dialog-root" role="presentation">
      <button
        type="button"
        className="lab-dialog-backdrop"
        aria-label="Close dialog"
        onClick={onCancel}
      />

      <div
        className={`lab-dialog card${isDanger ? ' lab-dialog--danger' : ''}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="lab-dialog-title"
        aria-describedby={description ? 'lab-dialog-desc' : undefined}
      >
        <div className="lab-dialog-header">
          <div className={`lab-dialog-icon${isDanger ? ' lab-dialog-icon--danger' : ''}`}>
            {isDanger ? (
              <AlertTriangle size={22} strokeWidth={1.8} />
            ) : (
              <FlaskConical size={22} strokeWidth={1.8} />
            )}
          </div>
          <div className="lab-dialog-heading">
            <p className="lab-dialog-kicker">Gray Matter LABS</p>
            <h2 id="lab-dialog-title" className="lab-dialog-title">
              {title}
            </h2>
          </div>
        </div>

        {description ? (
          <p id="lab-dialog-desc" className="lab-dialog-description">
            {description}
          </p>
        ) : null}

        <div className="lab-dialog-actions">
          <button ref={cancelRef} type="button" className="lab-dialog-btn lab-dialog-btn--ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`lab-dialog-btn${isDanger ? ' lab-dialog-btn--danger' : ' lab-dialog-btn--primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
