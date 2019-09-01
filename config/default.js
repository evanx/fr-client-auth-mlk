module.exports = {
  port: 3000,
  logger: {
    level: 'info',
  },
  redis: {
    host: '127.0.0.1',
    keyPrefix: 'fr:',
  },
  session: {
    ttlSeconds: 3690,
  },
  bcrypt: {
    rounds: 12,
  },
}
