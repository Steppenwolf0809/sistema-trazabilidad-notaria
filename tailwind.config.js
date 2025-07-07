/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./views/**/*.hbs', './public/js/**/*.js'],
  theme: {
    extend: {
      colors: {
        // PALETA PROFESIONAL NOTARIAL
        'primary': '#162840',
        'primary-light': '#4E7DA6',
        'primary-dark': '#0d1a2b',
        'secondary': '#BF8C60',
        'secondary-light': '#d4a574',
        'secondary-dark': '#a0734d',
        'success': '#B1C6B8',
        'warning': '#BF8C60',
        'danger': '#a0734d',
        'info': '#4E7DA6',
        'light': '#f8fafc',
        'dark': '#162840',
        'sidebar': '#162840',
        'sidebar-hover': '#4E7DA6',
        'gray-professional': '#D0D7D9',
        'gray-verdoso': '#B1C6B8'
      },
      spacing: {
        '68': '17rem',
        '76': '19rem'
      },
      minHeight: {
        '75': '75vh'
      }
    }
  },
  plugins: [],
}