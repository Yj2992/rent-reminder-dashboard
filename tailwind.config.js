/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ledgerBlue: {
          DEFAULT: "#2151c5",
          hover: "#1a43a7",
          container: "#dde7ff",
          dark: "#9fb8ff",
        },
        mint: {
          DEFAULT: "#0f8a73",
          hover: "#0c725f",
          container: "#d7f4ec",
          dark: "#7ce0c8",
        },
        amber: {
          DEFAULT: "#b57717",
          container: "#ffe6bf",
          dark: "#f7c56a",
        },
        coral: {
          DEFAULT: "#c53b27",
          container: "#fee4e1",
        },
        cloud: "#f4f7fb",
        paper: "#ffffff",
        mist: "#e7eef8",
        ink: "#182133",
        slate: "#60708d",
        line: {
          DEFAULT: "#ccd5e4",
          strong: "#b4c2d6",
        },
        deepNight: "#0e1628",
        nightSurface: "#172134",
        nightSurfaceAlt: "#202d46",
        nightLine: "#31405a",
        nightSlate: "#a6b4cf",
        nightInk: "#f3f7ff",
      },
      borderRadius: {
        'sm': '14px',
        'md': '20px',
        'lg': '28px',
      },
      keyframes: {
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "20%": { transform: "translateX(-8px)" },
          "40%": { transform: "translateX(8px)" },
          "60%": { transform: "translateX(-6px)" },
          "80%": { transform: "translateX(6px)" },
        },
      },
      animation: {
        shake: "shake 0.6s ease-in-out",
      },
    },
  },
  plugins: [],
}