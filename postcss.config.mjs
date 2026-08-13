const config = {
  plugins: {
    "@tailwindcss/postcss": {
      theme: {
        extend: {
          colors: {
            primary: {
              300: "#93c5fd",
              500: "#3b82f6",
              600: "#2563eb",
              700: "#1d4ed8",
              800: "#1e40af",
            },
          },
        },
      },
    },
  },
};

export default config;
