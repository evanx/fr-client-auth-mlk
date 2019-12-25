#!/bin/bash
set -e

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

_keys() {
  echo '☰ keys'
  redis-cli keys 'lula:*'
}

_keys

