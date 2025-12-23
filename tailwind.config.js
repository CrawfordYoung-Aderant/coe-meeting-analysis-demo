/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Primary Color Palette
        primary: {
          red: '#B30838',
          dark: '#1F3C4F',
          white: '#FFFFFF',
        },
        // Secondary Color Palette
        secondary: {
          dark: '#172B4D',
          blue: '#1379CE',
          purple: '#5A189A',
          red: '#F04B4C',
          yellow: '#FDBE03',
        },
        // Neutrals
        neutral: {
          black: '#000000',
          dark: '#434F56',
          medium: '#5C6B75',
          light: '#A1BDCA',
          lighter: '#D8DBDF',
          lightest: '#F5F8FA',
        },
      },
      fontFamily: {
        // Headlines and Subheads
        headline: ['Poppins', 'sans-serif'],
        // Copy text
        copy: ['Roboto', 'sans-serif'],
        // Condensed variant
        condensed: ['Roboto Condensed', 'sans-serif'],
      },
      fontWeight: {
        light: '300',
        normal: '400',
        medium: '500',
        semibold: '700', // Roboto doesn't have 600, using 700 (bold) as closest match
        bold: '700',
      },
    },
  },
  plugins: [],
}

