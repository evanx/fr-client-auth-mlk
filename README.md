# fastify-auth-mlk

Provide /register and /login endpoints for simple API bearer token auth.

See 

## /register

client - the ID of the client 
secret - the secret credentials chosen by the client
regToken - the token provided for registration 

## /login 

client - the ID of the client 
secret - the secret credentials chosen by the client

Returns: 
token - a session token

## /me

Requires header: `Authorization: Bearer {client}:{token}`

