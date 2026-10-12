import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: { extend: { colors: { ink: "#0B1117", panel: "#121B24", steel: "#7D8EA0", paper: "#E8EEF2", gain: "#2BFF88", loss: "#FF7A7A", amber: "#F2B84B" } } },
  plugins: [],
};
export default config;
