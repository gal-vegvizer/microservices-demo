#!/bin/bash

# Example test with the exact payload structure from requirements

curl -X POST http://localhost:8080 \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "email_subject": "Happy new year!",
      "email_sender": "John Doe",
      "email_timestream": "1693561101",
      "email_content": "Just want to say... Happy new year!!!"
    },
    "token": "$DJISA<$#45ex3RtYr"
  }'
