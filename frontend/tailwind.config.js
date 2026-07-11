/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      // tailwind.config.js - Option 1 updates
      colors: {
        canvas: "#F8FAFC", // very light, clean gray background
        surface: "#FFFFFF", // pure white cards
        surfaceHover: "#F1F5F9", // subtle hover gray
        coral: "#FF6B4A", // primary accent - live/active energy
        mint: "#3DDC97", // secondary accent - connected/presence
        ink: "#0F172A", // dark text
        muted: "#64748B", // secondary/muted text
      },

      keyframes: {
        floatUp: {
          "0%": { transform: "translateY(0)", opacity: "1" },
          "100%": { transform: "translateY(-160px)", opacity: "0" },
        },
      },
      animation: {
        "float-up": "floatUp 2.5s ease-out forwards",
      },

      fontFamily: {
        display: ["Fraunces", "serif"], // headlines - personality
        sans: ["Inter", "sans-serif"], // body/UI text
        mono: ["JetBrains Mono", "monospace"], // room codes
      },
      boxShadow: {
        glow: "0 0 0 3px rgba(255, 107, 74, 0.5), 0 0 24px rgba(255, 107, 74, 0.35)",
        glowMint:
          "0 0 0 3px rgba(61, 220, 151, 0.5), 0 0 24px rgba(61, 220, 151, 0.3)",
      },
      borderRadius: {
        portal: "2rem", // the soft rounded "portal" shape for video tiles
      },
    },
  },
  plugins: [],
};
