function ArxivIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" preserveAspectRatio="none">
      <rect width="32" height="32" rx="4" fill="#B31B1B" />
      <path
        d="M7 23V9h5l3.2 7.4L18.5 9H23v14h-3.4v-7.2L15.6 23h-2.2l-4.2-9.8V23H7z"
        fill="#fff"
      />
    </svg>
  );
}

function WikipediaIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" preserveAspectRatio="none">
      <rect width="32" height="32" rx="4" fill="#F5F5F5" />
      <text
        x="16"
        y="23"
        textAnchor="middle"
        fill="#1a1a1a"
        fontSize="22"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontWeight="700"
      >
        W
      </text>
    </svg>
  );
}

function WebIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" preserveAspectRatio="none">
      <rect width="32" height="32" rx="4" fill="#0a0a0a" />
      <circle cx="16" cy="16" r="9.5" stroke="#e8e8e8" strokeWidth="1.5" />
      <ellipse cx="16" cy="16" rx="4" ry="9.5" stroke="#e8e8e8" strokeWidth="1.3" />
      <path d="M6.5 16h19M8.5 11.5h15M8.5 20.5h15" stroke="#e8e8e8" strokeWidth="1.2" />
    </svg>
  );
}

function CalcIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" preserveAspectRatio="none">
      <rect width="32" height="32" rx="4" fill="#1a3d12" />
      <path
        d="M9 7h14v4H9V7zm0 6h14v13a2.5 2.5 0 0 1-2.5 2.5H11.5A2.5 2.5 0 0 1 9 26V13zm3 3v10h8V16h-8z"
        fill="#97c455"
      />
      <path d="M13 17.5h6M13 21h6" stroke="#b6ef62" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

const TOOL_ICONS = {
  arxiv: ArxivIcon,
  wikipedia: WikipediaIcon,
  web: WebIcon,
  calc: CalcIcon,
};

export default function ToolIcon({ toolId }) {
  const Icon = TOOL_ICONS[toolId];
  if (!Icon) return null;
  return (
    <span className="tool-icon-badge">
      <Icon />
    </span>
  );
}
