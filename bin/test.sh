#!/bin/bash
set -e
if [ $NODE_ENV = 'production' ]
then
  exit 1
fi
NODE_ENV=development

echo_stderr() {
  >&2 echo "$*"
}

_hgetall() {
  key=$1
  echo "#️⃣ $key"
  redis-cli hgetall $key
  echo '⏎'
}

_ttl() {
  key=$1
  echo "⚡ ttl $key"
  redis-cli ttl $key
}

_hget() {
  key=$1
  field=$2
  echo_stderr "⚡ hget $key $field"
  redis-cli --raw hget $key $field
}

redis-cli keys 'lula:*' | xargs -n1 redis-cli del

redis-cli del lula:client:test-client:h

regDeadline=`node -e 'console.log(Date.now()+3600*1000)'`
regToken=`node bin/bcrypt.js hash test-regToken`
redis-cli hset lula:client:test-client:h regToken "${regToken}"
redis-cli hset lula:client:test-client:h regDeadline "${regDeadline}"

_hgetall lula:client:test-client:h

echo '☸ /register'
curl -s -X 'POST' \
  -d 'client=test-client&secret=my-secret&regToken=test-regToken' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -H 'Accept: application/json' \
  http://127.0.0.1:3000/register | jq -r '.code' | grep -q '^200$'


echo '☸ /login'
token=`curl -s -X 'POST' -d 'client=test-client&secret=my-secret' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -H 'Accept: application/json' \
  http://127.0.0.1:3000/login | jq -r '.token'`
echo "☣ $token"

echo '☰ keys'
redis-cli keys 'lula:*'

_hgetall lula:count:login:h
_hgetall lula:count:register:h

_hgetall lula:client:test-client:h
_hgetall lula:session:$token:h
_ttl lula:session:$token:h
_hget lula:session:$token:h client | grep '^test-client$'

echo '✅ OK'
