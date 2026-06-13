/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // "Shadow Circuit" palette — deliberately distinct from
        // well-known social deduction game color schemes.
        ink: {
          950: '#0a0e17',
          900: '#0f1521',
          800: '#161d2e',
          700: '#1f283d',
          600: '#2b3650',
        },
        signal: {
          DEFAULT: '#5eead4', // teal accent (replaces generic "red sus" framing)
          dim: '#2dd4bf',
        },
        alert: {
          DEFAULT: '#fb7185',
          dim: '#f43f5e',
        },
        warn: {
          DEFAULT: '#fbbf24',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', '"Noto Sans Arabic"', 'system-ui', 'sans-serif'],
        body: ['"Inter"', '"Noto Sans Arabic"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl2: '1.25rem',
      },
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      },
    },
  },
  plugins: [],
};
