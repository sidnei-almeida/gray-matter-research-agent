function formatScore(score) {
  if (score == null) return null;
  const num = Number(score);
  if (!Number.isFinite(num)) return null;
  return num <= 1 ? `${Math.round(num * 100)}%` : `${Math.round(num)}%`;
}

export default function SourceCard({ source, url: legacyUrl }) {
  const normalized =
    typeof source === 'string'
      ? { url: source, title: source }
      : source && typeof source === 'object'
        ? source
        : legacyUrl
          ? { url: legacyUrl, title: legacyUrl }
          : null;

  if (!normalized) return null;

  const {
    url,
    title,
    sourceType,
    snippet,
    relevanceScore,
    usedInAnswer,
    id,
  } = normalized;

  const scoreLabel = formatScore(relevanceScore);
  const isRich = Boolean(title && title !== url) || sourceType || snippet || scoreLabel != null;
  const Wrapper = url ? 'a' : 'div';
  const wrapperProps = url
    ? {
        href: url,
        target: '_blank',
        rel: 'noopener noreferrer',
      }
    : {};

  if (!isRich) {
    if (!url) return null;
    return (
      <a href={url} className="source-card card" target="_blank" rel="noopener noreferrer">
        {url}
      </a>
    );
  }

  return (
    <Wrapper
      {...wrapperProps}
      className={`source-card source-card--rich card${url ? '' : ' source-card--static'}`}
      data-source-id={id || url || title}
    >
      <div className="source-card-top">
        <span className="source-card-title">{title || url}</span>
        {sourceType ? (
          <span className="source-card-type">{String(sourceType).replace(/_/g, ' ')}</span>
        ) : null}
      </div>

      {snippet ? <p className="source-card-snippet">{snippet}</p> : null}

      <div className="source-card-meta">
        {scoreLabel ? <span className="source-card-score">{scoreLabel} relevance</span> : null}
        {usedInAnswer === true ? <span className="source-card-used">Used in answer</span> : null}
        {url ? <span className="source-card-url">{url}</span> : null}
      </div>
    </Wrapper>
  );
}
