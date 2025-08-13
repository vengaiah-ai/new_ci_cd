import type { Config } from "tailwindcss";

// Minimal Tailwind config for compatibility with Bootstrap
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {},
  plugins: [],
} satisfies Config;
