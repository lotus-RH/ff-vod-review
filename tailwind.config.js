/** Used to build public/tailwind.css (see README.md, "Editing the styles"). */
module.exports = {
  content: ['./public/index.html'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        slate: { 850: '#111827', 900: '#0f172a', 950: '#080d1a' },
        ffpurple: { 400: '#a78bfa', 500: '#8b5cf6', 600: '#7c3aed', 900: '#2e1065' },
        ffcyan: { 400: '#38bdf8', 500: '#06b6d4', 600: '#0891b2' }
      }
    }
  }
};
