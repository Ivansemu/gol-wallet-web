// Web estática (Cloudflare Pages u otro hosting estático): todo lo dinámico va contra Supabase desde el navegador.
/** @type {import('next').NextConfig} */
export default {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
};
