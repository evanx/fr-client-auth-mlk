const assert = require('assert')
const pino = require('pino')

const defaultLevel = process.env.LOG_LEVEL || 'info'
const debugNames = !process.env.DEBUG ? [] : process.env.DEBUG.split(',')
const prettyPrint = !process.env.LOG_PRETTY
  ? false
  : { colorize: true, translateTime: true }

module.exports = ({ redis }, { name }, context) => {
  const level = debugNames.includes(name) ? 'debug' : defaultLevel
  const logger = pino({ name, level, prettyPrint })
  const increment = (type, data) => {
    logger.debug(data, 'increment', type)
    assert(name, 'name')
    redis.hincrby(`count:${name}:h`, type, 1).catch(console.error)
  }
  increment('start', context)
  return { logger, increment }
}
