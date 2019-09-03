const bcrypt = require('bcrypt')
const config = require('config')
const fastify = require('fastify')({ logger: config.logger })

fastify.register(require('fastify-formbody'))

fastify.register(require('fastify-redis'), config.redis)

const clock = () => Date.now()

const minTime = new Date('2019-01-01').getTime()

const counterFactory = ({ redis }, name, context) => {
  const counter = key =>
    redis.hincrby(`count:${name}:h`, key, 1).catch(console.error)
  counter('start')
  return counter
}

const register = async ({ clock, redis }, { client, secret, regToken }) => {
  const counter = counterFactory({ redis }, 'register', { client })
  const now = clock()
  const [regTokenRes, regBy] = await redis.hmget(
    `client:${client}:h`,
    'regToken',
    'regBy',
  )
  if (!regTokenRes) {
    counter('no regToken')
    return { code: 403, message: 'Unregistered (regToken`)' }
  }
  if (regToken !== regTokenRes) {
    counter('incorrect regToken')
    return { code: 403, message: 'Unauthorised (regToken)' }
  }
  if (!regBy) {
    counter('no regBy')
    return { code: 403, message: 'Unregistered', field: 'regBy' }
  }
  await redis.hdel(`client:${client}:h`, 'regBy')
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
  await redis.hset(`client:${client}:h`, 'bcrypt', bcryptRes)
  return { code: 200 }
}

const login = async ({ redis }, { client, secret }) => {
  const hash = await redis.hget(`client:${client}:h`, 'bcrypt')
  if (!hash) {
    return { code: 403, message: 'Unregistered' }
  }
  try {
    await bcrypt.compare(secret, hash)
  } catch (err) {
    return { code: 401, message: 'Unauthorised', errCode: err.code }
  }
  const token = Math.random()
    .toString()
    .slice(2)
  const { ttlSeconds } = config.session
  await redis
    .multi([
      ['del', `session:${token}:h`],
      ['hset', `session:${token}:h`, 'client', client],
      ['expire', `session:${token}:h`, ttlSeconds],
    ])
    .exec()
  return { code: 200, token, ttlSeconds }
}

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
    fastify.log.debug('register', { body: request.body })
    const res = await register({ clock, redis: fastify.redis }, request.body)
    reply.code(res.code).send(res)
  },
})

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
    fastify.log.debug('login', request)
    const res = await login({ clock, redis: fastify.redis }, request.body)
    reply.code(res.code).send(res)
  },
})

const start = async () => {
  try {
    await fastify.listen(config.port)
    fastify.log.info(`server listening on ${fastify.server.address().port}`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
