const bcrypt = require('bcrypt')
const config = require('config')

const { buildCounter, clock, multiAsync } = require('../utils')

const minTime = new Date('2019-01-01').getTime()

const register = async ({ clock, redis }, { client, secret, regToken }) => {
  const counter = buildCounter({ redis }, 'register', { client })
  const now = clock()
  const clientKey = `client:${client}:h`
  const [regTokenRes, regBy] = await redis.hmget(clientKey, 'regToken', 'regBy')
  if (!regTokenRes) {
    counter('no regToken')
    return { code: 403, message: 'Unregistered (regToken)', field: 'regToken' }
  }
  const compareRes = await bcrypt.compare(regToken, regTokenRes)
  if (!compareRes) {
    counter('incorrect regToken')
    return { code: 403, message: 'Unauthorized (regToken)', field: 'regToken' }
  }
  if (!regBy) {
    counter('no regBy')
    return { code: 403, message: 'Unregistered (regBy)', field: 'regBy' }
  }
  const expireTime = parseInt(regBy)
  if (expireTime < minTime) {
    counter('invalid expireTime')
    return { code: 403, message: 'Invalid expiry' }
  }
  if (expireTime <= now) {
    counter('expired')
    return { code: 403, message: 'Expired' }
  }
  const bcryptRes = await bcrypt.hash(secret, config.bcrypt.rounds)
  await multiAsync(redis, [
    ['del', clientKey],
    ['hset', clientKey, 'secret', bcryptRes],
  ])
  return { code: 200 }
}

module.exports = fastify =>
  fastify.route({
    method: 'POST',
    url: '/register',
    schema: {
      body: {
        type: 'object',
        required: ['client', 'secret', 'regToken'],
        properties: {
          client: { type: 'string' },
          secret: { type: 'string' },
          regToken: { type: 'string' },
        },
      },
    },
    handler: async (request, reply) => {
      fastify.log.debug({ client: request.body.client }, 'register')
      const res = await register({ clock, redis: fastify.redis }, request.body)
      reply.code(res.code).send(res)
    },
  })
