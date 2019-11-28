# lula-auth

Lula-auth is a scaleable microservice providing /register and /login endpoints for pre-authorized client auth,
intended for communications between distributed services and/or remote devices.

Lula-auth is used by Lula-hub - see https://github.com/evanx/lula-hub.

Lula-hub syncs Redis streams. Its limitation in IoT is that client devices must run Redis 5.

## Deployment recommendations

Note that each instance of this service should be rate limited to 4 requests per second e.g. via an Nginx Ingress Controller for Kubernetes.

Each endpoint can be rate limited by IP to 1 request per 10 seconds. Therefore client retries must be scheduled at 15 second intervals,
with exponential backoff, e.g. see https://github.com/evanx/lula-client.

## Usage

See https://github.com/evanx/lula-auth/blob/master/scripts/test.sh

![test.sh](/docs/test.jpg?raw=true 'test.sh')

The Administrator will provision a TOPT secret and a registration deadline for the client.

```shell
otpSecret=`node scripts/generateOtpSecret.js`
```

```shell
regDeadline=`node -e 'console.log(Date.now()+3600*1000)'`
```

These details are stored in Redis for the client e.g. `test-client.`

```shell
redis-cli hset lula:client:test-client:h otpSecret "${otpSecret}"
redis-cli hset lula:client:test-client:h regDeadline "${regDeadline}"
```

The client generates its secret password for authentication:

```
secret=`openssl rand 24 -base64`
```

The client registers their `secret` using a one-time passcode generated from their provisioned `otpSecret.`

```shell
otp=`node scripts/generateOtp.js "${otpSecret}"`
```

```shell
curl -s -X 'POST' \
  -d "client=test-client&secret=my-secret&otp=${otp}" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -H 'Accept: application/json' \
  http://127.0.0.1:3001/register
```

The client logs in using their `secret` and `otp` and receives a session token.

```shell
bearerToken=`
  curl -s -X 'POST' \
  -d "client=test-client&secret=my-secret&otp=${otp}" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -H 'Accept: application/json' \
  http://127.0.0.1:3001/login | jq -r '.bearerToken'`
```

The client accesses a related API using the session token as a `Bearer` token in the `Authorization` header.

```
Authorization: Bearer {bearerToken}
```

## Endpoints

### /register

https://github.com/evanx/lula-auth/tree/master/lib/register

- `client` - the ID of the client
- `secret` - the secret chosen by the client
- `otp` - an OTP generated using the provisioned `otpSecret`

#### Requires

Pre-authorisation of the registration via hashes key `client:${client}:h` with fields:

- `otpSecret` - an OTP secret provisioned to the client
- `regDeadline` - the epoch deadline for the registration by the client

#### Result

The secret is hashed using Bcrypt and stored in Redis.

See https://github.com/kelektiv/node.bcrypt.js

#### Usage

The client might generate its secret as follows:

```shell
$ openssl rand 24 -base64
TTDJ2uqo6VxIvaqiX52xEn8b2daxEhFV
```

### /login

https://github.com/evanx/lula-auth/tree/master/lib/login

- `client` - the ID of the client
- `secret` - the secret chosen by the client
- `otp` - an OTP generated using the provisioned `otpSecret`

#### Requires

Hashes key `client:${client}:h` with field:

- `secret` - the `/register` secret, salted and hashed using Bcrypt
- `otpSecret` - an OTP secret provisioned to the client

#### Returns

- `bearerToken` - a session token
- `ttlSeconds` - the TTL of the `bearerToken`

This session token is intended to be used as an HTTP auth "Bearer" token.

Note that once the token expires, the client will observe a 401 HTTP error code,
and should login again.

## Example usage

### lula-hub

See https://github.com/evanx/lula-hub

This project enables Redis stream ingress from authenticated clients via "Bearer" token.

```javascript
fastify.register(require('fastify-bearer-auth'), {
  auth: async (token, request) => {
    const client = await fastify.redis.hget(`session:${token}:h`, 'client')
    if (client) {
      request.client = client
      return true
    }
    return false
  },
  errorResponse: err => {
    return { code: 401, message: err.message }
  },
})
```

where the client includes the `token` from `/login` in the HTTP `Authorization` header:

```
Authorization: Bearer {token}
```

## Related

- https://github.com/evanx/lula-hub
