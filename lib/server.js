const assert = require('assert')
const bcrypt = require('bcrypt')
const config = require('config')
const lodash = require('lodash')
const fastify = require('fastify')({ logger: config.logger })

const monitorFactory = require('./monitor')
const monitor = monitorFactory({ name: 'server' })

fastify.register(require('fastify-formbody'))

fastify.register(require('fastify-redis'), config.redis)

const sessionCache = new Map()

const clock = () => Date.now()

const createSession = client => {
  const token = Math.random()
    .toString()
    .slice(2)
  const now = clock()
  const ttl = config.session.ttl
  const expires = now + ttl
  const session = {
    client,
    expires,
  }
  return { token, ttl, session }
}

const register = async ({ clock, redis }, client, secret) => {
  const now = clock()
  const score = await redis.zscore('register:z', client)
  if (!score) {
    return { code: 403, message: 'Unregistered' }
  }
  await redis.zrem('register:z', client)
  if (score > now) {
    return { code: 403, message: 'Expired' }
  }
  const bcryptRes = bcrypt.hash(secret, config.bcrypt.rounds)
  await redis.hset(`client:${client}:h`, 'bcrypt', bcryptRes)
  return { code: 200 }
}

const login = async ({ clock, redis }, client, secret) => {
  const hash = await redis.hget(`client:${client}:h`, 'bcrypt')
  if (!hash) {
    return { code: 403, message: 'Unregistered' }
  }
  await bcrypt.compare(secret, hash)
  const { token, ttl, session } = createSession(client)
  sessionCache.set(token, session)
  return { code: 200, token, ttl }
}

fastify.register(require('fastify-bearer-auth'), {
  auth: (token, request) => {
    monitor.count('auth')
    const session = sessionCache.get(token)
    if (session) {
      assert.strictEqual(typeof session.expires, 'number', 'expires')
      const now = clock()
      if (session.expires > 0 && session.expires < now) {
        request.session = session
        return true
      }
      monitor.count('auth expired')
    } else {
      monitor.count('auth missed')
    }
    return false
  },
})

fastify.route({
  method: 'POST',
  url: '/register',
  handler: async (request, reply) => {
    fastify.log.debug('register', request)
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
  },
})

fastify.route({
  method: 'POST',
  url: '/metrics',
  handler: async (request, reply) => {},
})

fastify.route({
  method: 'POST',
  url: '/xadd/:key',
  handler: async (request, reply) => {
    const { id = '*', token, ...props } = request.body
    const flattened = lodash.flatten(Object.entries(props))
    const idRes = await fastify.redis.xadd(request.params.key, id, ...flattened)
    reply.send({ id: idRes, session: request.session })
  },
})

const start = async () => {
  try {
    sessionCache.set('abc123', { expires: Date.now() + 3600 * 1000 })
    await fastify.listen(config.port)
    fastify.log.info(`server listening on ${fastify.server.address().port}`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
