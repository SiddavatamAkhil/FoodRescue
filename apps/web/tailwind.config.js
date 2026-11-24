/** @type {import('tailwindcss').Config} */
// FoodRescue design tokens. Every colour used in the product is defined here.
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        forest: { DEFAULT: "#174C3C", hover: "#10392D", 50: "#EEF4F0", 100: "#DCE9E1" },
        sage: { DEFAULT: "#6D927B", 50: "#F1F5F2" },
        mint: { DEFAULT: "#B8D6B2" },
        canvas: "#F7F8F5",
        surface: "#FFFFFF",
        ink: { DEFAULT: "#202A26", soft: "#3A4540" },
        muted: "#5F6964",
        line: { DEFAULT: "#E4E9E3", strong: "#CDD5CE" },
        success: { DEFAULT: "#27834A", text: "#1F6B3C", 50: "#EAF5EE" },
        warning: { DEFAULT: "#C48A31", text: "#8A5A12", 50: "#FBF3E6" },
        danger: { DEFAULT: "#C44747", text: "#A83737", 50: "#FBECEC" },
        info: { DEFAULT: "#3C6488", 50: "#ECF2F7" },
      },
      fontFamily: {
        sans: ['"Manrope Variable"', "Manrope", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      fontSize: {
        xs: ["0.75rem", { lineHeight: "1.1rem" }],
        sm: ["0.8125rem", { lineHeight: "1.25rem" }],
        base: ["0.9375rem", { lineHeight: "1.5rem" }],
        md: ["1rem", { lineHeight: "1.55rem" }],
        lg: ["1.125rem", { lineHeight: "1.65rem" }],
        xl: ["1.375rem", { lineHeight: "1.85rem", letterSpacing: "-0.01em" }],
        "2xl": ["1.75rem", { lineHeight: "2.2rem", letterSpacing: "-0.015em" }],
        "3xl": ["2.375rem", { lineHeight: "2.8rem", letterSpacing: "-0.02em" }],
        "4xl": ["3.25rem", { lineHeight: "3.6rem", letterSpacing: "-0.03em" }],
      },
      borderRadius: { sm: "4px", DEFAULT: "6px", md: "8px", lg: "10px" },
      boxShadow: {
        pop: "0 8px 24px -8px rgba(23, 40, 33, 0.18), 0 1px 2px rgba(23, 40, 33, 0.06)",
      },
      maxWidth: { prose: "68ch" },
      keyframes: {
        "fade-in": { from: { opacity: 0 }, to: { opacity: 1 } },
        "slide-up": { from: { opacity: 0, transform: "translateY(6px)" }, to: { opacity: 1, transform: "none" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
      },
      animation: {
        "fade-in": "fade-in 150ms ease-out",
        "slide-up": "slide-up 180ms ease-out",
      },
    },
  },
  plugins: [],
};
