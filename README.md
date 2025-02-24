# docker-container-stats

API for monitoring containers by label

## Build
``` shell
git clone https://github.com/kevinwhereby/docker-container-stats && cd docker-container-stats && docker build . -t docker-container-stats
```

## Run 
``` shell
docker run -p 3000:3000 --mount type=bind,src=/var/run/docker.sock,target=/var/run/docker.sock docker-container-stats
```

## Monitor a container
```
% docker run -dit -l foo=bar ubuntu:latest

% curl -X POST localhost:3000/monitor -d '{ "labels": { "foo": "bar" } }' -H "Content-Type: application/json"
> {"containerId":"3af7acd69a893f67b917d442b23e15d99320b7652edc7cddeb3b1bdec99bcb76"}

% curl localhost:3000/monitor/3af7acd69a893f67b917d442b23e15d99320b7652edc7cddeb3b1bdec99bcb76
> {"average":0}
```

