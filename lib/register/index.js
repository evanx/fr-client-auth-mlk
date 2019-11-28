const bcrypt = require('bcrypt')
const config = require('config')
const otplib = require('otplib')

const { buildMonitor, clock, multiAsync } = require('../utils')

const minTime = new Date('2019-01-01').getTime()

const register = async ({ clock, redis }, { client, otp, secret }) => {
  const { increment } = buildMonitor({ redis }, 'register', { client })
  const now = clock()
  const clientKey = `client:${client}:h`
  const [otpSecret, regDeadline] = await redis.hmget(
    clientKey,
    'otpSecret',
    'regDeadline',
  )
  if (!otpSecret) {
    increment('no otpSecret')
    return {
      code: 403,
      message: 'Unregistered (otpSecret)',
      field: 'otpSecret',
    }
  }
  if (!regDeadline) {
    increment('no regDeadline')
    return {
      code: 403,
      message: 'Unregistered (regDeadline)',
      field: 'regDeadline',
    }
  }
  const expireTime = parseInt(regDeadline)
  if (expireTime < minTime) {
    increment('invalid expireTime')
    return { code: 403, message: 'Invalid expiry' }
  }
  if (expireTime <= now) {
    increment('expired')
    return { code: 403, message: 'Expired' }
  }
  if (!otplib.authenticator.check(otp, otpSecret)) {
    increment('incorrect otp')
    return { code: 403, message: 'Unauthorized (otp)', field: 'otp' }
  }
  const bcryptRes = await bcrypt.hash(secret, config.bcrypt.rounds)
  await multiAsync(redis, [
    ['hdel', clientKey, 'regDeadline'],
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
        required: ['client', 'secret', 'otp'],
        properties: {
          client: { type: 'string' },
          secret: { type: 'string' },
          otp: { type: 'string' },
        },
      },
    },
    handler: async (request, reply) => {
      fastify.log.debug({ client: request.body.client }, 'register')
      const res = await register({ clock, redis: fastify.redis }, request.body)
      reply.code(res.code).send(res)
    },
  })
