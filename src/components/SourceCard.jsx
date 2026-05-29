export default function SourceCard({ url }) {
  return (
    <a href={url} className="source-card card" target="_blank" rel="noopener noreferrer">
      {url}
    </a>
  );
}
