const bcrypt = require('bcrypt')
const config = require('config')
const { buildRedis, endRedis, multiAsync } = require('../utils')
const { buildForm } = require('../utils/testing')
const redisClient = buildRedis(config.redis)

describe('login', () => {
  const state = {
    clientId: 'test-client',
    fastify: require('../fastify'),
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

  it('should reject unregistered login', async () => {
    const data = {
      client: state.clientId,
      secret: 'wrong-secret',
    }
    const payload = buildForm(data)
    const res = await state.fastify.inject({
      method: 'POST',
      url: '/login',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      payload,
    })
    expect(JSON.parse(res.body)).toStrictEqual({
      code: 403,
      message: 'Unregistered',
    })
  })

  it('should login', async () => {
    const data = {
      client: state.clientId,
      secret: 'test-secret',
    }
    const clientKey = `client:${data.client}:h`
    await multiAsync(redisClient, [
      ['del', clientKey],
      [
        'hset',
        clientKey,
        'secret',
        await bcrypt.hash(data.secret, config.bcrypt.rounds),
      ],
    ])
    const payload = buildForm(data)
    const res = await state.fastify.inject({
      method: 'POST',
      url: '/login',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      payload,
    })
    const resPayload = JSON.parse(res.payload)
    expect(resPayload).toMatchObject({
      code: 200,
      ttlSeconds: 3690,
    })
    expect(resPayload.token).toBeTruthy()
    await expect(
      redisClient.hget(`session:${resPayload.token}:h`, 'client'),
    ).resolves.toStrictEqual(state.clientId)
  })
})
