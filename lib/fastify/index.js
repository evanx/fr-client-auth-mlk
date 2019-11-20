const config = require('config')
const fastify = require('fastify')({ logger: config.logger })

fastify.register(require('fastify-formbody'))
fastify.register(require('fastify-redis'), config.redis)

module.exports = fastify
