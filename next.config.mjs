/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    // Allow cross-origin requests to development server assets from specified origins (dev only)
    // See: https://nextjs.org/docs/app/api-reference/config/next-config-js/allowedDevOrigins
    allowedDevOrigins: [
        "localhost",
        "127.0.0.1",
        // Add your tunnel domain(s); wildcard subdomains supported
        "stunning-correct-serval.ngrok-free.app",
        "*.ngrok-free.app",
    ],
    experimental: {
        serverActions: {
            bodySizeLimit: "2mb",
        },
    },
};

export default nextConfig;
