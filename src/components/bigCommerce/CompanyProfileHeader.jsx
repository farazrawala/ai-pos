import {
  FaBoxOpen,
  FaCalendarDays,
  FaLayerGroup,
  FaLocationDot,
  FaPhone,
  FaStar,
  FaStore,
  FaWhatsapp,
} from 'react-icons/fa6';
import {
  buildWhatsAppUrl,
  formatJoinedDate,
  renderStars,
  toWhatsAppPhoneDigits,
} from '../../features/bigCommerce/marketplaceUtils.js';

const PLACEHOLDER_COVER =
  'linear-gradient(135deg, #0f766e 0%, #134e4a 42%, #1e3a5f 100%)';

export default function CompanyProfileHeader({ company, loading }) {
  if (loading && !company) {
    return (
      <section className="bc-profile bc-profile--skeleton" aria-hidden="true">
        <div className="bc-cover bc-skeleton" />
        <div className="bc-profile-body">
          <div className="bc-logo bc-skeleton" />
          <div className="bc-skeleton bc-skeleton-line w-40" />
          <div className="bc-skeleton bc-skeleton-line w-70" />
        </div>
      </section>
    );
  }

  const profile = company || {};
  const coverStyle = profile.coverUrl
    ? { backgroundImage: `url(${profile.coverUrl})` }
    : { backgroundImage: PLACEHOLDER_COVER };
  const hasWhatsAppPhone = Boolean(toWhatsAppPhoneDigits(profile.phone));
  const whatsappUrl = hasWhatsAppPhone
    ? buildWhatsAppUrl(
        profile.phone,
        `Hi, I'm contacting you from ${profile.name || 'your store'} on Big Commerce.`
      )
    : '';

  return (
    <section className="bc-profile">
      <div className="bc-cover" style={coverStyle} role="img" aria-label="Company cover">
        <div className="bc-cover-overlay" />
        <div className="bc-cover-label">
          <FaStore aria-hidden="true" />
          Marketplace store
        </div>
      </div>

      <div className="bc-profile-body">
        <div className="bc-logo-wrap">
          {profile.logoUrl ? (
            <img
              className="bc-logo"
              src={profile.logoUrl}
              alt={`${profile.name || 'Company'} logo`}
              loading="lazy"
            />
          ) : (
            <div className="bc-logo bc-logo--fallback" aria-hidden="true">
              {(profile.name || 'C').charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="bc-profile-main">
          <div className="bc-profile-title-row">
            <div>
              <div className="bc-company-heading">
                <h1 className="bc-company-name">{profile.name || 'Company Marketplace'}</h1>
                <span className="bc-verified-badge">
                  <FaStore aria-hidden="true" />
                  Seller
                </span>
              </div>
              {profile.description ? (
                <p className="bc-company-tagline">{profile.description}</p>
              ) : (
                <p className="bc-company-tagline bc-muted">
                  Browse products from this company marketplace
                </p>
              )}
            </div>
            {whatsappUrl ? (
              <a
                className="bc-btn bc-btn-whatsapp"
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={`WhatsApp ${profile.phone}`}
              >
                <span className="bc-whatsapp-icon">
                  <FaWhatsapp aria-hidden="true" />
                </span>
                <span className="bc-whatsapp-copy">
                  <small>Available on WhatsApp</small>
                  <strong>Chat with store</strong>
                </span>
              </a>
            ) : null}
          </div>

          <ul className="bc-profile-meta">
            {profile.location ? (
              <li>
                <span className="bc-meta-icon"><FaLocationDot aria-hidden="true" /></span>
                <span>
                  <span className="bc-meta-label">Location</span>
                  <strong>{profile.location}</strong>
                </span>
              </li>
            ) : null}
            {hasWhatsAppPhone ? (
              <li>
                <span className="bc-meta-icon"><FaPhone aria-hidden="true" /></span>
                <span>
                  <span className="bc-meta-label">Phone</span>
                  <strong>{profile.phone}</strong>
                </span>
              </li>
            ) : null}
            <li>
              <span className="bc-meta-icon"><FaBoxOpen aria-hidden="true" /></span>
              <span>
                <span className="bc-meta-label">Products</span>
                <strong>{Number(profile.totalProducts || 0).toLocaleString()}</strong>
              </span>
            </li>
            <li>
              <span className="bc-meta-icon"><FaLayerGroup aria-hidden="true" /></span>
              <span>
                <span className="bc-meta-label">Categories</span>
                <strong>{Number(profile.totalCategories || 0).toLocaleString()}</strong>
              </span>
            </li>
            <li>
              <span className="bc-meta-icon"><FaStar aria-hidden="true" /></span>
              <span>
                <span className="bc-meta-label">Rating</span>
                <strong className="bc-stars" title={profile.rating ? `${profile.rating}/5` : 'No rating'}>
                  {profile.rating != null ? renderStars(profile.rating) : 'Not rated'}
                </strong>
              </span>
            </li>
            <li>
              <span className="bc-meta-icon"><FaCalendarDays aria-hidden="true" /></span>
              <span>
                <span className="bc-meta-label">Member since</span>
                <strong>{formatJoinedDate(profile.joinedAt)}</strong>
              </span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
