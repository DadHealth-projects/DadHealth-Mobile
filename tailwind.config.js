/** @type {import('tailwindcss').Config} */
// NativeWind config for dadHealth Mobile.
// Colors + fonts mirror the web (dadHealth/src/index.css + tailwind.config.ts).
module.exports = {
  content: [
    './App.js',
    './screens/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './navigation/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        lime: '#C8F55A',
        'lime-hover': '#D5F77E',
        dark: '#0A0A0A',
        card: '#111111',
        muted: '#1F1F1F',
        border: '#1F1F1F',
        'muted-text': '#C7C7C7',
        'tertiary-text': '#A6A6A6',
      },
      fontFamily: {
        // Barlow Condensed (headings) — loaded via expo-font in App.js
        heading: ['BarlowCondensed-ExtraBold'],
        'heading-bold': ['BarlowCondensed-Bold'],
        'heading-semibold': ['BarlowCondensed-SemiBold'],
        // Barlow (body)
        body: ['Barlow-Regular'],
        'body-medium': ['Barlow-Medium'],
        'body-semibold': ['Barlow-SemiBold'],
      },
      // Spacing scale from theme.ts (8px increments)
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '32px',
      },
      borderRadius: {
        card: '16px',
        button: '12px',
      },
      letterSpacing: {
        label: '2.5px',
      },
    },
  },
  plugins: [],
};
