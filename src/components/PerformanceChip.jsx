import { FaBolt, FaGaugeHigh, FaWifi } from 'react-icons/fa6';
import NavIcon from './NavIcon.jsx';
import { usePageLoadTime } from '../hooks/usePageLoadTime.js';
import { useNetworkSpeed } from '../hooks/useNetworkSpeed.js';
import { useOnlineStatus } from '../hooks/useOnlineStatus.js';
import './performanceChip.css';

const formatDuration = (ms) => {
  if (ms == null || !Number.isFinite(ms)) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(ms < 10000 ? 2 : 1)} s`;
};

const formatSpeed = (mbps) => {
  if (mbps == null || !Number.isFinite(mbps)) return '—';
  if (mbps >= 10) return `${Math.round(mbps)} Mbps`;
  if (mbps >= 1) return `${mbps.toFixed(1)} Mbps`;
  return `${Math.round(mbps * 1000)} Kbps`;
};

const speedTone = (mbps) => {
  if (mbps == null || !Number.isFinite(mbps)) return 'unknown';
  if (mbps >= 10) return 'good';
  if (mbps >= 2) return 'fair';
  return 'poor';
};

const loadTone = (ms) => {
  if (ms == null) return 'unknown';
  if (ms <= 1000) return 'good';
  if (ms <= 3000) return 'fair';
  return 'poor';
};

/**
 * Header chip: page/route load time + live connection speed.
 * Click the speed pill to re-measure throughput.
 */
export default function PerformanceChip() {
  const isOnline = useOnlineStatus();
  const { ms, kind, detail } = usePageLoadTime();
  const { downlink, rtt, effectiveType, approximate, updatedAt, measuring, measure } =
    useNetworkSpeed({ enabled: isOnline });

  const loadTitle = detail
    ? `Page load ${formatDuration(detail.total)} · TTFB ${formatDuration(
        detail.ttfb
      )} · DOM ready ${formatDuration(detail.domReady)}`
    : kind === 'route'
      ? 'Time to render this route'
      : 'Page load time';

  const speedLabel = !isOnline
    ? 'Offline'
    : downlink == null && measuring
      ? 'Measuring…'
      : `${approximate ? '≈' : ''}${formatSpeed(downlink)}`;

  const speedTitleParts = [
    'Measured download speed',
    effectiveType ? `Network ${effectiveType.toUpperCase()}` : '',
    rtt != null ? `Latency ${rtt} ms` : '',
    updatedAt ? `Updated ${new Date(updatedAt).toLocaleTimeString()}` : '',
    'Click to re-measure',
  ].filter(Boolean);

  return (
    <div className="perf-chip" role="group" aria-label="Performance">
      <span
        className={`perf-chip__item perf-chip__item--${loadTone(ms)}`}
        title={loadTitle}
      >
        <NavIcon icon={FaGaugeHigh} size={11} />
        <span className="perf-chip__label">{kind === 'route' ? 'Route' : 'Load'}</span>
        <span className="perf-chip__value">{formatDuration(ms)}</span>
      </span>

      <button
        type="button"
        className={`perf-chip__item perf-chip__item--button perf-chip__item--${
          isOnline ? speedTone(downlink) : 'poor'
        }${measuring ? ' perf-chip__item--measuring' : ''}`}
        onClick={measure}
        disabled={!isOnline}
        title={isOnline ? speedTitleParts.join(' · ') : 'No internet connection'}
      >
        <NavIcon icon={isOnline ? FaWifi : FaBolt} size={11} />
        <span className="perf-chip__value">{speedLabel}</span>
      </button>
    </div>
  );
}
