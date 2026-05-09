declare const _default: () => {
    port: number;
    nodeEnv: string;
    jwt: {
        secret: string;
        expiresIn: string;
        refreshSecret: string;
        refreshExpiresIn: string;
    };
    database: {
        url: string;
    };
    redis: {
        url: string;
    };
    minio: {
        endpoint: string;
        port: number;
        accessKey: string;
        secretKey: string;
        bucket: string;
        useSSL: boolean;
    };
    cors: {
        origins: string[];
    };
    throttle: {
        ttl: number;
        limit: number;
    };
};
export default _default;
