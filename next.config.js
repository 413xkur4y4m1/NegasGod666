/** @type {import('next').NextConfig} */
const nextConfig = {
  // Solucionar advertencia de Cross origin request
  // Permite explícitamente solicitudes de origen cruzado durante desarrollo
  allowedDevOrigins: ['192.168.202.1', '9000-firebase-negasgod666git-1760249108965.cluster-c72u3gwiofapkvxrcwjq5zllcu.cloudworkstations.dev'],
  
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
    
    // FIX: Se elimina la configuración `externals` que es problemática para Vercel.
    // Las dependencias del servidor deben ser empaquetadas con las funciones.
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