#!/bin/bash
set -e
if [ $NODE_ENV = 'production' ]
then
  exit 1
fi

_hgetall() {
  key=$1
  echo "#️⃣ $key"
  redis-cli hgetall $key
  echo '⏎'
}

_ttl() {
  echo "⚡ ttl $key"
  redis-cli ttl $key
}

redis-cli keys 'fr:*' | xargs -n1 redis-cli del

redis-cli del fr:client:test-client:h

redis-cli hset fr:client:test-client:h regToken test-regToken
redis-cli hset fr:client:test-client:h regBy 1777000111000 

_hgetall fr:client:test-client:h

echo '☸ /register'
curl -s -X 'POST' -d 'client=test-client&secret=my-secret&regToken=test-regToken' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -H "Accept: application/json" \
  http://127.0.0.1:3000/register | jq -r '.code' | grep -q '^200$'


echo '☸ /login'
token=`curl -s -X 'POST' -d 'client=test-client&secret=my-secret' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -H "Accept: application/json" \
  http://127.0.0.1:3000/login | jq -r '.token'`
echo "☣ $token"

echo '☸ /me'
curl -s -H 'Accept: application/json' -H "Authorized: Bearer test-client:$token" \
  'http://127.0.0.1:3000/me' | jq -r '.client' | grep -q '^test-client$'

echo '☰ keys'
redis-cli keys 'fr:*'

_hgetall fr:count:login:h
_hgetall fr:count:register:h
_hgetall fr:client:test-client:h
_hgetall fr:session:$token:h
_ttl fr:session:$token:h

