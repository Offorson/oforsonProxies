import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,js,jsx,md,mdx}"],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1280px" }
    },
    extend: {
      colors: {
        brand: {
          50: "#ecfeff",
          100: "#cffafe",
          200: "#a5f3fc",
          300: "#67e8f9",
          400: "#22d3ee",
          500: "#06b6d4",
          600: "#0891b2",
          700: "#0e7490",
          800: "#155e75",
          900: "#164e63"
        },
        ink: {
          50: "#f8f9fb",
          100: "#eef0f4",
          200: "#dde1ea",
          300: "#c0c6d2",
          400: "#9aa2b3",
          500: "#6b7280",
          600: "#4b5563",
          700: "#374151",
          800: "#1f2937",
          900: "#0b1220"
        }
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Inter", "Satoshi", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      borderRadius: {
        xl: "14px",
        "2xl": "20px",
        "3xl": "28px"
      },
      boxShadow: {
        soft: "0 1px 2px rgba(16, 24, 40, 0.04), 0 8px 24px rgba(16, 24, 40, 0.06)",
        glow: "0 10px 40px -10px rgba(6, 182, 212, 0.45)",
        ring: "0 0 0 6px rgba(6, 182, 212, 0.08)"
      },
      backgroundImage: {
        "grid-light":
          "linear-gradient(rgba(15,23,42,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.06) 1px, transparent 1px)",
        "radial-fade":
          "radial-gradient(60% 60% at 50% 0%, rgba(34, 211, 238, 0.18) 0%, rgba(255,255,255,0) 70%)"
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" }
        },
        pulseDot: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.5", transform: "scale(1.2)" }
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" }
        }
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        pulseDot: "pulseDot 2s ease-in-out infinite",
        slideUp: "slideUp 0.6s ease-out forwards",
        shimmer: "shimmer 2.4s linear infinite"
      }
    }
  },
  plugins: []
};

export default config;
