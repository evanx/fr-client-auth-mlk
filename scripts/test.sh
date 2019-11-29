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
otpSecret=`node scripts/generate-otp-secret.js`
redis-cli hset lula:client:test-client:h otpSecret "${otpSecret}"
redis-cli hset lula:client:test-client:h regDeadline "${regDeadline}"

_hgetall lula:client:test-client:h

otp=`node scripts/generate-otp.js "${otpSecret}"`

echo '☸ /register'
curl -s -X 'POST' \
  -d "client=test-client&secret=my-secret&otp=${otp}" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -H 'Accept: application/json' \
  http://127.0.0.1:3001/register | jq -r '.code' | grep -q '^200$'


echo '☸ /login'
bearerToken=`curl -s -X 'POST' -d "client=test-client&secret=my-secret&otp=${otp}" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -H 'Accept: application/json' \
  http://127.0.0.1:3001/login | jq -r '.bearerToken'`
echo "☣ $bearerToken"

echo '☰ keys'
redis-cli keys 'lula:*'

_hgetall lula:count:login:h
_hgetall lula:count:register:h

_hgetall lula:client:test-client:h
_hgetall lula:session:$bearerToken:h
_ttl lula:session:$bearerToken:h
_hget lula:session:$bearerToken:h client | grep '^test-client$'

echo '✅ OK'
