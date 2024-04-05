#!/bin/sh

# Wait for another service to be ready before starting
dockerize -wait tcp://some-service:port -timeout 60s

# Start your application
npm start
