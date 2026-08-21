import { Check, Monitor, WifiOff } from 'lucide-react';
import SectionHeader from '../components/SectionHeader/SectionHeader.jsx';
import Reveal from '../components/Reveal.jsx';

const offlinePoints = [
  'Sell at the counter even when Wi‑Fi is down',
  'Orders and payments save locally, then sync',
  'No waiting on the network to finish checkout',
];

const windowsPoints = [
  'Install once on Windows PCs at the shop',
  'Open like a desktop app — no browser tab hunting',
  'Same offline-ready POS your team already uses',
];

export default function OfflineSection() {
  return (
    <section className="oh-section" id="offline">
      <div className="oh-container">
        <SectionHeader
          eyebrow="Offline & Windows"
          title="Keep Working When The Internet Doesn’t."
          description="Orders Hub runs offline and as a Windows desktop app — so your shop stays open even without a connection."
        />
        <div className="oh-offline-grid">
          <Reveal>
            <article className="oh-offline-card">
              <div className="oh-offline-card__icon" aria-hidden="true">
                <WifiOff size={22} />
              </div>
              <h3 className="oh-h3">Offline Mode</h3>
              <p className="oh-muted">
                Use the software without internet. Sales continue locally and sync automatically when
                you are back online.
              </p>
              <ul className="oh-checklist">
                {offlinePoints.map((item) => (
                  <li key={item}>
                    <Check size={16} strokeWidth={2.4} aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          </Reveal>
          <Reveal delay={80}>
            <article className="oh-offline-card">
              <div className="oh-offline-card__icon" aria-hidden="true">
                <Monitor size={22} />
              </div>
              <h3 className="oh-h3">Windows App</h3>
              <p className="oh-muted">
                Install Orders Hub on Windows and run POS, inventory, and reports from the desktop —
                including offline.
              </p>
              <ul className="oh-checklist">
                {windowsPoints.map((item) => (
                  <li key={item}>
                    <Check size={16} strokeWidth={2.4} aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
