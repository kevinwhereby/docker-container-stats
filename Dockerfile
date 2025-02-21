FROM node:22-bookworm-slim

COPY package.json /opt
COPY yarn.lock /opt
COPY dist /opt

WORKDIR /opt

RUN npx yarn install

ENTRYPOINT ["node", "index.js"]
