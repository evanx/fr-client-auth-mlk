const config = require('config')
const pino = require('pino')
const Redis = require('ioredis')

const buildCounter = ({ redis }, name, context) => {
  const counter = key =>
    redis.hincrby(`count:${name}:h`, key, 1).catch(console.error)
  counter('start')
  return counter
}

const buildId = () =>
  Math.random()
    .toString(36)
    .slice(2) +
  Math.random()
    .toString(36)
    .slice(1)

const buildPromise = fn =>
  new Promise((resolve, reject) =>
    fn((err, res) => (err ? reject(err) : resolve(res))),
  )

const buildLogger = loggerConfig =>
  pino(Object.assign({}, config.logger, loggerConfig))

const buildRedis = redisConfig => new Redis(redisConfig)

const clock = () => Date.now()

const endRedis = redisClient => redisClient.quit()

const multiAsync = async (redis, commands, hook) => {
  const results = await redis.multi(commands).exec()
  const err = results.find(([err]) => err)
  if (err) {
    throw new Error(err)
  }
  const res = results.map(([, res]) => res)
  if (hook) {
    hook({ commands, res })
  }
  return res
}

module.exports = {
  buildCounter,
  buildId,
  buildLogger,
  buildPromise,
  buildRedis,
  clock,
  endRedis,
  multiAsync,
}
