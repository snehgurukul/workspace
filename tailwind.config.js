/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
const scale = (name, steps) => Object.fromEntries(steps.map((s) => [s, v(`${name}-${s}`)]));

// Neutral colours come from CSS variables so the whole app can switch to dark mode in one place (see index.css).
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: v("ink"),
        surface: v("surface"),
        slate: scale("slate", [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]),
        brand: { ...scale("brand", [50, 100]), 400: "#FB923C", 500: "#F97316", 600: "#EA580C", 700: v("brand-700") },
      },
      fontFamily: { sans: ["Inter", "system-ui", "sans-serif"] },
      boxShadow: {
        soft: "0 1px 2px rgb(15 23 42 / 0.04), 0 1px 3px rgb(15 23 42 / 0.06)",
        lift: "0 4px 12px -2px rgb(15 23 42 / 0.08), 0 2px 4px -2px rgb(15 23 42 / 0.06)",
      },
    },
  },
  plugins: [],
};
