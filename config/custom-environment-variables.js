module.exports = {
  port: 'PORT',
  redis: {
    host: 'REDIS_HOST',
    port: 'REDIS_PORT',
    password: 'REDIS_PASSWORD',
    keyPrefix: 'REDIS_PREFIX',
  },
  session: {
    ttlSeconds: 'SESSION_TTL_SECS',
  },
  bcrypt: {
    rounds: 'BCRYPT_ROUNDS',
  },
  logger: {
    level: 'LOG_LEVEL',
    prettyPrint: 'LOG_PRETTY',
  },
}
