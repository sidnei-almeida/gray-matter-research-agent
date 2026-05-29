import headImg from '../../images/head.png';

export default function AgentAvatar({ size = 'md', className = '' }) {
  return (
    <img
      src={headImg}
      alt="Heisenberg Research Agent"
      className={`agent-avatar-img agent-avatar-${size} ${className}`.trim()}
    />
  );
}
