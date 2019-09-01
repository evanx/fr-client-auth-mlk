# fastify-auth-mlk

Provide /register and /login endpoints for simple Redis-based API bearer token auth.

See https://github.com/evanx/fastify-auth-mlk/blob/master/bin/test.sh

## /register

client - the ID of the client
secret - the secret credentials chosen by the client
regToken - the token provided for registration

### Result

The secret is hashed using Bcrypt and stored in Redis.

See https://github.com/kelektiv/node.bcrypt.js

## /login

client - the ID of the client
secret - the secret credentials chosen by the client

### Returns

token - a session token

## /me

When logged in, include the session token in the following header:

```
Authorization: Bearer {client}:{token}
```
