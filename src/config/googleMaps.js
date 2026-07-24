/** Google Maps JavaScript API key (Places + Maps). */
const DEFAULT_GOOGLE_MAPS_API_KEY = 'AIzaSyCab5ahH6KkodUavDwBCigXTL7ZbrkzS94';

export const GOOGLE_MAPS_API_KEY = String(
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY || DEFAULT_GOOGLE_MAPS_API_KEY || ''
).trim();
