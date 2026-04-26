/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}", "./data/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
        mono: ["var(--font-mono)"]
      },
      boxShadow: {
        panel: "0 28px 80px rgba(15, 23, 42, 0.12)",
        soft: "0 18px 40px rgba(15, 23, 42, 0.08)"
      },
      keyframes: {
        "feedback-pop": {
          "0%": {
            opacity: "0.85",
            transform: "scale(0.98)"
          },
          "55%": {
            opacity: "1",
            transform: "scale(1.02)"
          },
          "100%": {
            opacity: "1",
            transform: "scale(1)"
          }
        },
        "card-rise": {
          "0%": {
            opacity: "0",
            transform: "translateY(14px)"
          },
          "100%": {
            opacity: "1",
            transform: "translateY(0)"
          }
        },
        "wave-drift": {
          "0%, 100%": {
            transform: "translate3d(0, 0, 0)"
          },
          "50%": {
            transform: "translate3d(0, 10px, 0)"
          }
        }
      },
      animation: {
        "feedback-pop": "feedback-pop 520ms ease-out",
        "card-rise": "card-rise 420ms ease-out",
        "wave-drift": "wave-drift 8s ease-in-out infinite"
      }
    }
  },
  plugins: []
};
