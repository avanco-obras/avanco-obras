export default () => ({
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwt: {
    secret: process.env.JWT_SECRET || 'super-secret-key-change-in-prod',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'refresh-secret-key-change-in-prod',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },
  database: {
    url: process.env.DATABASE_URL,
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  minio: {
    endpoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: process.env.MINIO_PORT ? parseInt(process.env.MINIO_PORT, 10) : undefined,
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    bucket: process.env.MINIO_BUCKET || 'avanco-obras',
    useSSL: process.env.MINIO_USE_SSL === 'true',
    // Região explícita evita que o cliente faça lookup de região na rede ao
    // assinar URLs (lookup que falharia no cliente público apontado p/ localhost).
    region: process.env.MINIO_REGION || 'us-east-1',
    // Endpoint público usado APENAS para assinar URLs entregues ao navegador.
    // Em dev, o backend fala com o MinIO pelo host interno do Docker ("minio"),
    // mas o navegador só alcança "localhost". Default cai no endpoint interno
    // para que produção (R2/endpoint já público) continue funcionando sem config extra.
    publicEndpoint:
      process.env.MINIO_PUBLIC_ENDPOINT ||
      process.env.MINIO_ENDPOINT ||
      'localhost',
    publicPort: process.env.MINIO_PUBLIC_PORT
      ? parseInt(process.env.MINIO_PUBLIC_PORT, 10)
      : process.env.MINIO_PORT
        ? parseInt(process.env.MINIO_PORT, 10)
        : undefined,
    publicUseSSL: process.env.MINIO_PUBLIC_USE_SSL
      ? process.env.MINIO_PUBLIC_USE_SSL === 'true'
      : process.env.MINIO_USE_SSL === 'true',
  },
  cors: {
    origins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:80').split(','),
  },
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL || '60', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT || '100', 10),
  },
  mistral: {
    apiKey: process.env.MISTRAL_API_KEY || '',
    model: process.env.MISTRAL_MODEL || 'mistral-small-latest',
  },
});
