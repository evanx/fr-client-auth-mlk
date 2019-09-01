const state = {}

const factory = context => {
  const metrics = new Map()
  const count = key => {
    const value = metrics.get(key)
    if (!value) {
      metrics.set(key, 1)
    } else {
      metrics.set(key, value + 1)
    }
  }
  const start = (key, context) => {
    count(key)
  }
  return {
    count,
  }
}
