#!/usr/bin/env bash

docker build -t uk-trademarks-crawl . --no-cache

docker run -it \
    -p 3000:3000 \
    --security-opt=seccomp=unconfined \
    uk-trademarks-crawl