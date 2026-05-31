import { useEffect, useState } from 'react';
import { checkHealth } from '../services/researchAgent';
import { labVitals as mockVitals, periodicElements } from '../data/mockData';
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
  const [apiOnline, setApiOnline] = useState(null);
  const [toolCount, setToolCount] = useState(null);

  useEffect(() => {
    let cancelled = false;

    checkHealth().then(({ online, data }) => {
      if (cancelled) return;
      setApiOnline(online);
      const tools = data?.available_tools;
      if (Array.isArray(tools)) setToolCount(tools.length);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const vitals = mockVitals.map((item) => {
    if (item.label === 'Lab Status' && apiOnline != null) {
      return {
        ...item,
        value: apiOnline ? 'API online' : 'API offline',
        isStatus: true,
        progress: apiOnline ? 100 : 12,
      };
    }
    if (item.label === 'Data Sources Active' && toolCount != null) {
      return { ...item, value: String(toolCount), progress: Math.min(100, toolCount * 20) };
    }
    return item;
  });

  return (
    <section className="lab-vitals-section">
      <div
        className="lab-vitals-card card"
        style={{ backgroundImage: `url(${sideImg})` }}
      >
        <div className="lab-vitals-inner">
          <h2 className="lab-vitals-title">Lab Vitals</h2>

          <div className="lab-vitals-stats">
            {vitals.map((item) => (
              <div key={item.label} className="vital-stat-row">
                <div className="vital-stat-header">
                  <span className="vital-label">{item.label}</span>
                  <span
                    className={`vital-value${item.label === 'Lab Status' && apiOnline ? ' vital-value--online' : ''}`}
                  >
                    {item.label === 'Lab Status' && apiOnline ? (
                      <span className="pulse-dot" aria-hidden="true" />
                    ) : null}
                    {item.value}
                    {item.isStatus && apiOnline === false ? (
                      <span className="vital-status-dot vital-status-dot--offline" aria-hidden="true" />
                    ) : null}
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
