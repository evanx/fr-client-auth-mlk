const bcrypt = require('bcrypt')
const config = require('config')
const otplib = require('otplib')

const { buildRedis, endRedis, multiAsync } = require('../utils')
const { buildForm } = require('../utils/testing')
const redisClient = buildRedis(config.redis)

describe('login', () => {
  const state = {
    clientId: 'test-client',
    secret: 'test-secret',
    otpSecret: otplib.authenticator.generateSecret(),
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
      otp: otplib.authenticator.generate(state.otpSecret),
      secret: 'test-secret',
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
      message: 'Unregistered (secret)',
    })
  })

  it('should reject if missing OTP secret in Redis', async () => {
    const data = {
      client: state.clientId,
      otp: otplib.authenticator.generate(state.otpSecret),
      secret: 'test-secret',
    }
    await multiAsync(redisClient, [
      ['del', state.clientKey],
      [
        'hset',
        state.clientKey,
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
    expect(JSON.parse(res.body)).toStrictEqual({
      code: 403,
      message: 'Unregistered (otpSecret)',
    })
  })

  it('should reject incorrect OTP', async () => {
    const data = {
      client: state.clientId,
      otp: '123456',
      secret: 'test-secret',
    }
    await multiAsync(redisClient, [
      ['del', state.clientKey],
      [
        'hset',
        state.clientKey,
        'otpSecret',
        state.otpSecret,
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
    expect(JSON.parse(res.body)).toStrictEqual({
      code: 401,
      message: 'Unauthorized (otp)',
    })
  })

  it('should reject incorrect secret', async () => {
    const data = {
      client: state.clientId,
      otp: otplib.authenticator.generate(state.otpSecret),
      secret: 'wrong-secret',
    }
    await multiAsync(redisClient, [
      ['del', state.clientKey],
      [
        'hset',
        state.clientKey,
        'otpSecret',
        state.otpSecret,
        'secret',
        await bcrypt.hash(state.secret, config.bcrypt.rounds),
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
    expect(JSON.parse(res.body)).toStrictEqual({
      code: 401,
      message: 'Unauthorized (secret)',
    })
  })

  it('should login', async () => {
    const data = {
      client: state.clientId,
      otp: otplib.authenticator.generate(state.otpSecret),
      secret: 'test-secret',
    }
    await multiAsync(redisClient, [
      ['del', state.clientKey],
      [
        'hset',
        state.clientKey,
        'otpSecret',
        state.otpSecret,
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
    expect(resPayload.bearerToken).toBeTruthy()
    await expect(
      redisClient.hget(`session:${resPayload.bearerToken}:h`, 'client'),
    ).resolves.toStrictEqual(state.clientId)
  })
})
