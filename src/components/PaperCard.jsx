function formatAuthors(authors = []) {
  if (!authors.length) return 'Unknown authors';
  if (authors.length <= 2) return authors.join(', ');
  return `${authors.slice(0, 2).join(', ')} +${authors.length - 2}`;
}

function formatScore(score) {
  if (score == null) return null;
  const num = Number(score);
  if (!Number.isFinite(num)) return null;
  return num <= 1 ? `${Math.round(num * 100)}%` : `${Math.round(num)}%`;
}

export default function PaperCard({ paper }) {
  if (!paper) return null;

  const {
    title,
    authors = [],
    year,
    abstract,
    url,
    pdfUrl,
    categories = [],
    relevanceScore,
    whyItMatches,
  } = paper;

  const scoreLabel = formatScore(relevanceScore);
  const abstractPreview =
    abstract && abstract.length > 220 ? `${abstract.slice(0, 220).trim()}…` : abstract;

  return (
    <article className="paper-card card">
      <header className="paper-card-header">
        <h4 className="paper-card-title">{title}</h4>
        {scoreLabel ? <span className="paper-card-score">{scoreLabel} match</span> : null}
      </header>

      <p className="paper-card-meta">
        {formatAuthors(authors)}
        {year ? ` · ${year}` : ''}
      </p>

      {categories.length > 0 ? (
        <div className="paper-card-tags">
          {categories.slice(0, 4).map((cat) => (
            <span key={cat} className="paper-card-tag">
              {cat}
            </span>
          ))}
        </div>
      ) : null}

      {abstractPreview ? <p className="paper-card-abstract">{abstractPreview}</p> : null}

      {whyItMatches ? (
        <p className="paper-card-why">
          <span className="paper-card-why-label">Why it matches</span>
          {whyItMatches}
        </p>
      ) : null}

      <div className="paper-card-links">
        {url ? (
          <a href={url} target="_blank" rel="noopener noreferrer" className="paper-card-link">
            View paper
          </a>
        ) : null}
        {pdfUrl ? (
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="paper-card-link paper-card-link--pdf">
            PDF
          </a>
        ) : null}
      </div>
    </article>
  );
}
