import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f2fbfe",
          100: "#dbf4fc",
          200: "#baeaf8",
          300: "#97dff2",
          400: "#7ccbe6",
          500: "#58b4d5",
          600: "#3f93b2",
          700: "#32758e",
          800: "#295c70",
          900: "#203d4d",
        },
        ink: "#0f172a",
        mist: "#f8fafc",
        sand: "#eef8fc",
      },
      boxShadow: {
        card: "0 22px 50px -30px rgba(32, 61, 77, 0.28)",
      },
      backgroundImage: {
        "portal-grid":
          "linear-gradient(rgba(63,147,178,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(63,147,178,0.08) 1px, transparent 1px)",
      },
    },
  },
  plugins: [],
};

export default config;
