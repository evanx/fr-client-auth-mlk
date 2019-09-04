const assert = require('assert')
const bcrypt = require('bcrypt')
const config = require('config')

const messages = {
  commands: 'Commands: help, hash, compare',
  hash: 'Args: secret',
  compare: 'Args: secret hash',
}

const exit = key => {
  console.error(messages[key] || key)
  process.exit(1)
}

const start = async () => {
  if (process.argv.length === 2) {
    exit('commands')
  }
  const command = process.argv[2]
  if (command === 'hash') {
    if (process.argv.length === 4) {
      const [secret] = process.argv.slice(3)
      const hash = await bcrypt.hash(secret, config.bcrypt.rounds)
      if (process.env.NODE_ENV !== 'production') {
        const compareRes = await bcrypt.compare(secret, hash)
        assert(compareRes)
      }
      console.log(hash)
      return
    }
    exit('hash')
  } else if (command === 'compare') {
    if (process.argv.length === 5) {
      const [secret, hash] = process.argv.slice(3)
      const ok = await bcrypt.compare(secret, hash)
      if (ok) {
        console.log('OK')
        return
      }
      console.log('Unmatched:', hash)
      return
    }
    exit('compare')
  } else if (command === 'help') {
    exit('commands')
  } else {
    exit('commands')
  }
}

start()
