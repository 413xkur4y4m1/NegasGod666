/** @type {import('next').NextConfig} */
const nextConfig = {
  // Solucionar advertencia de Cross origin request
  // Permite explícitamente solicitudes de origen cruzado durante desarrollo
  allowedDevOrigins: ['192.168.202.1'],
  
  // Configuración para imágenes remotas
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        pathname: '/**',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Configuración para módulos del cliente
      config.resolve.fallback = {
        ...config.resolve.fallback,
        async_hooks: false,
        fs: false,
        net: false,
        tls: false,
        perf_hooks: false,
        child_process: false,
        dgram: false,
        dns: false,
        http2: false,
      };
    }
    
    // Excluir paquetes problemáticos del bundle del servidor
    if (isServer) {
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : []),
        'nodemailer',
        '@opentelemetry/context-async-hooks',
        'google-auth-library',
        'gcp-metadata',
        'jaeger-client',
        'thriftrw'
      ];
    }
    return config;
  },
};

// Añadir configuraciones específicas para desarrollo
if (process.env.NODE_ENV === 'development') {
  // Opcionalmente, puedes activar estas opciones en desarrollo
  // nextConfig.typescript = { ignoreBuildErrors: true };
  // nextConfig.eslint = { ignoreDuringBuilds: true };
}

module.exports = nextConfig;