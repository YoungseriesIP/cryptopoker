# Arc Poker — Game Server (WebSocket backend)
# Deploy this to Railway or Fly.io for production WebSocket support.
FROM oven/bun:1.2-alpine

WORKDIR /app

# Copy only what the server needs
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Copy source files the server imports
COPY server/ ./server/
COPY src/types/ ./src/types/
COPY src/lib/ ./src/lib/

EXPOSE 3001

ENV PORT=3001

CMD ["bun", "run", "server/game-server.ts"]
