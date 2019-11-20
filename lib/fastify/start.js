const config = require('config')

module.exports = async fastify => {
  try {
    require('../register')(fastify)
    require('../login')(fastify)
    await fastify.listen(config.port)
    fastify.log.info(`Server listening on ${fastify.server.address().port}`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}
