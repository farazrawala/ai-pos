import { FaWhatsapp } from 'react-icons/fa6';
import {
  buildWhatsAppUrl,
  formatJoinedDate,
  renderStars,
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
  const whatsappUrl = buildWhatsAppUrl(
    profile.phone,
    `Hi, I'm contacting you from ${profile.name || 'your store'} on Big Commerce.`
  );

  return (
    <section className="bc-profile">
      <div className="bc-cover" style={coverStyle} role="img" aria-label="Company cover">
        <div className="bc-cover-overlay" />
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
              <h1 className="bc-company-name">{profile.name || 'Company Marketplace'}</h1>
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
                <FaWhatsapp aria-hidden="true" />
                WhatsApp
              </a>
            ) : null}
          </div>

          <ul className="bc-profile-meta">
            {profile.location ? (
              <li>
                <span className="bc-meta-label">Location</span>
                <span>{profile.location}</span>
              </li>
            ) : null}
            {profile.phone ? (
              <li>
                <span className="bc-meta-label">Phone</span>
                <span>{profile.phone}</span>
              </li>
            ) : null}
            <li>
              <span className="bc-meta-label">Products</span>
              <span>{Number(profile.totalProducts || 0).toLocaleString()}</span>
            </li>
            <li>
              <span className="bc-meta-label">Categories</span>
              <span>{Number(profile.totalCategories || 0).toLocaleString()}</span>
            </li>
            <li>
              <span className="bc-meta-label">Rating</span>
              <span className="bc-stars" title={profile.rating ? `${profile.rating}/5` : 'No rating'}>
                {profile.rating != null ? renderStars(profile.rating) : '—'}
              </span>
            </li>
            <li>
              <span className="bc-meta-label">Joined</span>
              <span>{formatJoinedDate(profile.joinedAt)}</span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
