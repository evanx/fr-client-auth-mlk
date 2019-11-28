module.exports = {
  port: 3001,
  logger: {
    level: 'info',
  },
  redis: {
    host: '127.0.0.1',
    keyPrefix: 'lula:',
  },
  session: {
    ttlSeconds: 3690,
  },
  bcrypt: {
    rounds: 12,
  },
}
