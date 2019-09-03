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
- `secret` - the secret credentials chosen by the client
- `regToken` - the token provided for registration

#### Requires

- hashes key `client:${client}:h` with fields `regToken`, `regBy`

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

### /login

- `client` - the ID of the client
- `secret` - the secret credentials chosen by the client

#### Requires

- hashes key `client:${client}:h` with field `bcrypt`

```javascript
const hash = await redis.hget(`client:${client}:h`, 'bcrypt')
```

#### Returns

- `token` - a session token

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
