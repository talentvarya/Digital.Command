import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#dbe6fe",
          200: "#bfd3fe",
          300: "#93b4fc",
          400: "#608bf8",
          500: "#3d66f0",
          600: "#2947e0",
          700: "#2236c2",
          800: "#212f9c",
          900: "#1f2a7a",
          950: "#0f1440",
        },
        ink: {
          50: "#f6f7f9",
          100: "#eceef2",
          200: "#d5d9e2",
          300: "#b1b8c8",
          400: "#8590a8",
          500: "#65708c",
          600: "#505974",
          700: "#41485f",
          800: "#383e50",
          900: "#171a24",
          950: "#0b0d13",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
