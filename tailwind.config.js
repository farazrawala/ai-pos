/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  // Bootstrap navbar uses class "collapse"; do not emit Tailwind's visibility:collapse utility.
  blocklist: ['collapse'],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {},
  },
  plugins: [],
};
