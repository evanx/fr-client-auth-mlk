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

_del() {
  echo redis-cli del "$@"
  redis-cli del "$@" | grep -q '^[01]$'
}

_hset() {
  echo redis-cli hset "$@"
  redis-cli hset "$@" | grep -q '^[01]$'
}

_redis1() {
  echo redis-cli "$@"
  redis-cli "$@" | grep -q ^1$
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

_keys() {
  echo '☰ keys'
  redis-cli keys 'lula:*'
}

redis-cli keys 'lula:*' | xargs -n1 redis-cli del

_del lula:client:test-client:h

_keys

regDeadline=`node -e 'console.log(Date.now()+3600*1000)'`
otpSecret=`node scripts/generate-otp-secret.js`
_hset lula:client:test-client:h otpSecret "${otpSecret}"
_hset lula:client:test-client:h regDeadline "${regDeadline}"

_hgetall lula:client:test-client:h

otp=`node scripts/generate-otp.js "${otpSecret}"`

echo '☸ /register'
curl -s -X 'POST' \
  -d "client=test-client&secret=my-secret&otp=${otp}" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -H 'Accept: application/json' \
  http://127.0.0.1:3001/register | jq -r '.code' | grep -q '^200$'

echo '☸ /login'
loginRes=`curl -s -X 'POST' -d "client=test-client&secret=my-secret&otp=${otp}" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -H 'Accept: application/json' \
  http://127.0.0.1:3001/login`
echo "$loginRes"
sessionToken=`echo "$loginRes" | jq -r '.sessionToken'`
echo -n "$sessionToken" | shasum
sessionTokenSha=`node -e "console.log(require('crypto').createHash('sha1').update('$sessionToken').digest('hex'))"`
echo "☣ $sessionToken $sessionTokenSha"

_keys

_hgetall lula:count:login:h
_hgetall lula:count:register:h

echo

_hgetall lula:client:test-client:h
_hgetall lula:session:$sessionTokenSha:h
_ttl lula:session:$sessionTokenSha:h
_hgetall lula:session:$sessionTokenSha:h
_hget lula:session:$sessionTokenSha:h client | grep '^test-client$'

echo '✅ OK'

