import { labVitals, periodicElements } from '../data/mockData';
import sideImg from '../../images/side.png?url';

function PeriodicCell({ number, symbol, name }) {
  return (
    <div className="periodic-cell">
      <span className="periodic-number">{number}</span>
      <span className="periodic-symbol">{symbol}</span>
      <span className="periodic-name">{name}</span>
    </div>
  );
}

export default function LabVitals() {
  return (
    <section className="lab-vitals-section">
      <div
        className="lab-vitals-card card"
        style={{ backgroundImage: `url(${sideImg})` }}
      >
        <div className="lab-vitals-inner">
          <h2 className="lab-vitals-title">Lab Vitals</h2>

          <div className="lab-vitals-stats">
            {labVitals.map((item) => (
              <div key={item.label} className="vital-stat-row">
                <div className="vital-stat-header">
                  <span className="vital-label">{item.label}</span>
                  <span className="vital-value">
                    {item.value}
                    {item.isStatus && <span className="vital-status-dot" aria-hidden="true" />}
                  </span>
                </div>
                {item.progress != null && (
                  <div className="vital-progress-track">
                    <div
                      className="vital-progress-fill"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="periodic-row">
            {periodicElements.map((el) => (
              <PeriodicCell key={el.symbol} {...el} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
