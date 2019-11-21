const config = require('config')
const fastify = require('fastify')({ logger: config.logger })

fastify.register(require('fastify-formbody'))
fastify.register(require('fastify-redis'), config.redis)

require('../register')(fastify)
require('../login')(fastify)

module.exports = fastify
