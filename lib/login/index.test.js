const bcrypt = require('bcrypt')
const config = require('config')
const {
  buildLogger,
  buildRedis,
  endRedis,
  multiAsync,
} = require('../lib/utils')
const { buildForm } = require('./utils')
const redisClient = buildRedis(config.redis)
const logger = buildLogger({ name: 'lula.integration', level: 'debug' })

describe('lula-auth', () => {
  const state = {
    clientId: 'test-client',
    fastify: require('../lib/buildFastify').fastify,
  }

  beforeAll(async () => {
    state.clientKey = `client:${state.clientId}:h`
    const time = await redisClient.time()
    state.startTimeMs = Math.floor(
      parseInt(time[0]) * 1000 + parseInt(time[1]) / 1000,
    )
    expect(state.startTimeMs).toBeGreaterThan(1555e9)
    expect(state.startTimeMs).toBeLessThan(1999e9)
  })

  beforeEach(async () => {
    await redisClient.del(state.clientKey)
  })

  afterAll(async () => {
    state.fastify.close()
    await endRedis(redisClient)
  })

  it('should forbid unregistered', async () => {
    const data = {
      client: state.clientId,
      secret: 'test-secret',
      regToken: 'test-regToken',
    }
    const payload = buildForm(data)
    const res = await state.fastify.inject({
      method: 'POST',
      url: '/register',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      payload,
    })
    expect(JSON.parse(res.body)).toStrictEqual({
      code: 403,
      field: 'regToken',
      message: 'Unregistered (regToken)',
    })
  })

  it('should forbid unauthorized registration', async () => {
    const data = {
      client: state.clientId,
      secret: 'test-secret',
      regToken: 'test-regToken',
    }
    await redisClient.hmset(
      state.clientKey,
      'regToken',
      await bcrypt.hash('wrong-regToken', config.bcrypt.rounds),
    )
    const payload = buildForm(data)
    const res = await state.fastify.inject({
      method: 'POST',
      url: '/register',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      payload,
    })
    expect(JSON.parse(res.body)).toStrictEqual({
      code: 403,
      field: 'regToken',
      message: 'Unauthorized (regToken)',
    })
  })

  it('should forbid missing expiry', async () => {
    const data = {
      client: state.clientId,
      secret: 'test-secret',
      regToken: 'test-regToken',
    }
    await redisClient.hmset(
      state.clientKey,
      'regToken',
      await bcrypt.hash(data.regToken, config.bcrypt.rounds),
    )
    const payload = buildForm(data)
    const res = await state.fastify.inject({
      method: 'POST',
      url: '/register',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      payload,
    })
    expect(JSON.parse(res.body)).toStrictEqual({
      code: 403,
      field: 'regBy',
      message: 'Unregistered (regBy)',
    })
  })

  it('should forbid invalid registration deadline', async () => {
    const data = {
      client: state.clientId,
      secret: 'test-secret',
      regToken: 'test-regToken',
    }
    await redisClient.hmset(
      state.clientKey,
      'regToken',
      await bcrypt.hash(data.regToken, config.bcrypt.rounds),
      'regBy',
      '1',
    )
    const payload = buildForm(data)
    const res = await state.fastify.inject({
      method: 'POST',
      url: '/register',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      payload,
    })
    expect(JSON.parse(res.body)).toStrictEqual({
      code: 403,
      message: 'Invalid expiry',
    })
  })

  it('should forbid expired registration', async () => {
    const data = {
      client: state.clientId,
      secret: 'test-secret',
      regToken: 'test-regToken',
    }
    await redisClient.hmset(
      state.clientKey,
      'regToken',
      await bcrypt.hash(data.regToken, config.bcrypt.rounds),
      'regBy',
      '1',
    )
    const payload = buildForm(data)
    const res = await state.fastify.inject({
      method: 'POST',
      url: '/register',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      payload,
    })
    expect(JSON.parse(res.body)).toStrictEqual({
      code: 403,
      message: 'Invalid expiry',
    })
  })
})
