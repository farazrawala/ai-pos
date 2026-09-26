import { contactInitials } from './chatUtils.jsx';

const AVATAR_COLORS = ['#00a884', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#14b8a6', '#6366f1', '#ef4444'];

function avatarColor(name) {
  const s = String(name || '');
  let hash = 0;
  for (let i = 0; i < s.length; i += 1) hash = (hash * 31 + s.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function WhatsappAvatar({ name, src, online, size = 46 }) {
  const style = {
    width: size,
    height: size,
    fontSize: size > 40 ? '0.95rem' : '0.8rem',
    background: avatarColor(name),
  };
  return (
    <div className="wa-avatar" style={style} aria-hidden={!online}>
      {contactInitials(name)}
      {src ? (
        <img src={src} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
      ) : null}
      {online ? <span className="wa-online-dot" title="Online" /> : null}
    </div>
  );
}
