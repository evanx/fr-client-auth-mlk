const buildForm = object =>
  Object.entries(object)
    .map(([key, value]) => key + '=' + encodeURIComponent(value))
    .join('&')

module.exports = {
  buildForm,
}
