"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = () => ({
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
//# sourceMappingURL=configuration.js.map