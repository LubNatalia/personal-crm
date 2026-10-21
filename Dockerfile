# syntax=docker/dockerfile:1

# Production image, built by CI. It holds the Next.js standalone server and
# the database scripts (migrations, test data) that run as one-off containers
# from the same image.

FROM node:24-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# The pnpm version pinned in package.json ("packageManager")
RUN npm install --global "$(node -p 'require("./package.json").packageManager')" \
 && pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
# public/ may be missing: git does not keep empty folders
RUN mkdir -p public && pnpm build
# The database scripts run with Node's built-in TypeScript support and need
# only these packages, none of which has dependencies of its own
RUN mkdir -p /db/node_modules/@faker-js /db/node_modules/@next \
 && cp -rL node_modules/drizzle-orm node_modules/postgres /db/node_modules/ \
 && cp -rL node_modules/@faker-js/faker /db/node_modules/@faker-js/ \
 && cp -rL node_modules/@next/env /db/node_modules/@next/ \
 && cp src/db/schema.ts src/db/migrate.ts src/db/seed.ts /db/ \
 && echo '{ "type": "module" }' > /db/package.json

FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build /app/public ./public
# The server writes its page cache under .next, so the app user owns it
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /db ./db
USER node
EXPOSE 3000
# Commit SHA, shown by /health
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION
CMD ["node", "server.js"]
