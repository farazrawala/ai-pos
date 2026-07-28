import { contactInitials } from './chatUtils.jsx';

export default function WhatsappAvatar({ name, src, online, size = 48 }) {
  const style = { width: size, height: size, fontSize: size > 40 ? '1rem' : '0.8rem' };
  return (
    <div className="wa-avatar" style={style} aria-hidden={!online}>
      {src ? (
        <img src={src} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
      ) : (
        contactInitials(name)
      )}
      {online ? <span className="wa-online-dot" title="Online" /> : null}
    </div>
  );
}
