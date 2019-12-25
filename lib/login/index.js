const bcrypt = require('bcrypt')
const config = require('config')
const otplib = require('otplib')

const { buildMonitor, buildId, buildSha1, clock } = require('../utils')

const login = async ({ redis }, { client, otp, secret }) => {
  const { increment } = buildMonitor({ redis }, { name: 'login' }, { client })
  const [otpSecret, secretHash] = await redis.hmget(
    `client:${client}:h`,
    'otpSecret',
    'secret',
  )
  if (!secretHash) {
    return { code: 403, message: 'Unregistered (secret)' }
  }
  if (!otpSecret) {
    return { code: 403, message: 'Unregistered (otpSecret)' }
  }
  if (!otplib.authenticator.check(otp, otpSecret)) {
    increment('unauthorized:otp')
    return { code: 401, message: 'Unauthorized (otp)' }
  }
  try {
    if (!(await bcrypt.compare(secret, secretHash))) {
      increment('unauthorized:secret')
      return { code: 401, message: 'Unauthorized (secret)' }
    }
  } catch (err) {
    increment('unauthorized:bcrypt:err')
    return { code: 401, message: 'Unauthorized', errCode: err.code }
  }
  const sessionToken = buildId()
  const sessionTokenSha = buildSha1(sessionToken)
  const { ttlSeconds } = config.session
  await redis
    .multi([
      ['del', `session:${sessionTokenSha}:h`],
      ['hset', `session:${sessionTokenSha}:h`, 'client', client],
      ['expire', `session:${sessionTokenSha}:h`, ttlSeconds],
    ])
    .exec()
  return { code: 200, sessionToken, sessionTokenSha, ttlSeconds }
}

module.exports = fastify =>
  fastify.route({
    method: 'POST',
    url: '/login',
    schema: {
      body: {
        type: 'object',
        required: ['client', 'secret', 'otp'],
        properties: {
          client: { type: 'string' },
          opt: { type: 'string' },
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
