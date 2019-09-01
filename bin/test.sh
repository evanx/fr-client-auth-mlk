#!/bin/bash
set -e
if [ $NODE_ENV = 'production' ]
then
  echo "Unsupported NODE_ENV: $NODE_ENV"
  exit 1
fi

set -x 

curl -X 'POST' -d 'client=test&secret=test' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -H "Accept: application/json" \
  http://127.0.0.1:3000/register


exit 0 

curl -X 'POST' -d 'type=test&source=test' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -H "Accept: application/json" \
  -H "Authorization: Bearer abc123" \
  http://127.0.0.1:3000/xadd/mystream:x 

