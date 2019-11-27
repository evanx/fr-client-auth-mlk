const otplib = require('otplib')

const otpSecret = process.argv[2]

if (!otpSecret) {
  process.exit(1)
}

console.log(otplib.authenticator.generate(otpSecret))
