FROM oven/bun:1.4.2-slim AS dependencies
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM dependencies AS build
COPY . .
RUN bun run --bun typecheck && bun run --bun build

FROM oven/bun:1.4.2-slim AS production
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY --chown=bun:bun src/db ./src/db
COPY --chown=bun:bun src/server/auth.ts src/server/operator-auth.ts src/server/maintenance.ts ./src/server/
COPY --chown=bun:bun scripts/accounts.ts scripts/prune.ts ./scripts/

FROM production AS migrate
COPY --chown=bun:bun scripts/migrate.ts ./scripts/migrate.ts
COPY --chown=bun:bun drizzle ./drizzle
USER bun
ENTRYPOINT ["bun", "scripts/migrate.ts"]
CMD ["apply"]

FROM production AS runtime
COPY --from=build --chown=bun:bun /app/dist ./dist
COPY --chown=bun:bun drizzle ./drizzle
ENV NODE_ENV=production
ENV PORT=3000
USER bun
EXPOSE 3000
CMD ["bun", "dist/server/index.js"]
