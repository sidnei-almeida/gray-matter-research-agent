export default function GmLogo({ variant = 'default', showText = true, className = '' }) {
  return (
    <div className={`gm-logo gm-logo--${variant} ${className}`.trim()}>
      <div className="gm-symbol" aria-hidden="true">
        <span className="gm-number">87</span>
        <span className="gm-element">Gm</span>
      </div>
      {showText && (
        <div className="gm-wordmark">
          <span className="gm-wordmark-primary">Gray Matter</span>
          <span className="gm-wordmark-labs">LABS</span>
        </div>
      )}
    </div>
  );
}
