# Arc Poker — Game Server (WebSocket backend)
FROM oven/bun:1.2-alpine

WORKDIR /app

# Copy package files and install deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy the full source tree the server needs
COPY server/ ./server/
COPY src/ ./src/

EXPOSE 3001

ENV PORT=3001
ENV NODE_ENV=production

CMD ["bun", "run", "server/game-server.ts"]
