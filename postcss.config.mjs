// Tailwind is used only by the custom dashboard (src/app/(dashboard)).
// It only processes CSS files that import it, so the Payload admin's styles are untouched.
const config = {
  plugins: { '@tailwindcss/postcss': {} },
}

export default config
