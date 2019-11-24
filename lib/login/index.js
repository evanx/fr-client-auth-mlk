const bcrypt = require('bcrypt')
const config = require('config')

const { buildCounter, buildId, clock } = require('../utils')

const login = async ({ redis }, { client, secret }) => {
  const counter = buildCounter({ redis }, 'register', { client })
  const hash = await redis.hget(`client:${client}:h`, 'secret')
  if (!hash) {
    return { code: 403, message: 'Unregistered' }
  }
  try {
    await bcrypt.compare(secret, hash)
  } catch (err) {
    counter('unauthorized')
    return { code: 401, message: 'Unauthorized', errCode: err.code }
  }
  const bearerToken = buildId()
  const { ttlSeconds } = config.session
  await redis
    .multi([
      ['del', `session:${bearerToken}:h`],
      ['hset', `session:${bearerToken}:h`, 'client', client],
      ['expire', `session:${bearerToken}:h`, ttlSeconds],
    ])
    .exec()
  return { code: 200, bearerToken, ttlSeconds }
}

module.exports = fastify =>
  fastify.route({
    method: 'POST',
    url: '/login',
    schema: {
      body: {
        type: 'object',
        required: ['client', 'secret'],
        properties: {
          client: { type: 'string' },
          secret: { type: 'string' },
        },
      },
    },
    handler: async (request, reply) => {
      fastify.log.debug({ client: request.body.client }, 'login')
      const res = await login({ clock, redis: fastify.redis }, request.body)
      reply.code(res.code).send(res)
    },
  })
