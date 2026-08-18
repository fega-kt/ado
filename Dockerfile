FROM node:20-alpine AS build

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN corepack prepare pnpm@10.33.0 --activate \
 && pnpm install --frozen-lockfile

COPY public ./public
COPY build.js ./
RUN node build.js

FROM node:20-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN corepack prepare pnpm@10.33.0 --activate \
 && pnpm install --prod --frozen-lockfile

COPY server.js ./
COPY --from=build /app/dist ./dist

ENV PORT=3000
ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "server.js"]
