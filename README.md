# fastify-auth-mlk

Provide /register and /login endpoints for simple Redis-based API bearer token auth.

## Usage

See https://github.com/evanx/fastify-auth-mlk/blob/master/bin/test.sh

```shell
curl -s -X 'POST' \
  -d 'client=test-client&secret=my-secret&regToken=test-regToken' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -H "Accept: application/json" \
  http://127.0.0.1:3000/register
```

<hr>

![test.sh](/docs/20190903-test.jpg?raw=true 'test.sh')

## Endpoints

See implementation:

https://github.com/evanx/fastify-auth-mlk/blob/master/lib/server.js

### /register

- `client` - the ID of the client
- `secret` - the secret chosen by the client
- `regToken` - the token provided for registration

The client might generate its secret as follows:

```shell
openssl rand 24 -base64
```

```shell
TTDJ2uqo6VxIvaqiX52xEn8b2daxEhFV
```

#### Requires

Pre-authorisation of the registration via:

Hashes key `client:${client}:h` with fields:

- `regToken` - a token issued to the client for registration
- `regBy` - epoch deadline for registration

We might authorise the registration as follows:

```shell
redis-cli hset fr:client:test-client:h regToken test-regToken
redis-cli hset fr:client:test-client:h regBy 1567495717000
```

##### Implementation

```javascript
const [regTokenRes, regBy] = await redis.hmget(
  `client:${client}:h`,
  'regToken',
  'regBy',
)
```

#### Result

The secret is hashed using Bcrypt and stored in Redis.

See https://github.com/kelektiv/node.bcrypt.js

##### Implementation

```javascript
const bcryptRes = await bcrypt.hash(secret, config.bcrypt.rounds)
await redis.hset(`client:${client}:h`, 'bcrypt', bcryptRes)
```

### /login

- `client` - the ID of the client
- `secret` - the secret credentials chosen by the client

#### Requires

Hashes key `client:${client}:h` with field:

- `bcrypt` - the `/register` secret, hashed and salted using Bcrypt

##### Implementation

```javascript
const hash = await redis.hget(`client:${client}:h`, 'bcrypt')
```

```javascript
await bcrypt.compare(secret, hash)
```

#### Returns

- `token` - a session token

##### Implementation

We generate the session token using `Math.random()` as follows.

```javascript
const randomToken = () =>
  Math.random()
    .toString(36)
    .substring(2)
```

## Related

### xadd

See https://github.com/evanx/fastify-xadd-mlk

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
    return { code: 401, error: err.message }
  },
})
```

where the client includes the `token` from `/login` in the HTTP `Authorization` header:

```
Authorization: Bearer {token}
```
