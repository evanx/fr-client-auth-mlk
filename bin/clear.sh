#!/bin/bash
set -e
[ $NODE_ENV != 'development' ]

redis-cli keys 'fr:*' | xargs -n1 redis-cli del
