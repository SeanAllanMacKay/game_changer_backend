# ---- Build stage: install all deps and compile TS -> dist/ ----
FROM node:22-slim AS builder
WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# Compile TypeScript
COPY tsconfig.json ./
COPY src ./src
RUN yarn build

# ---- Runtime stage: prod deps + compiled output only ----
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Only production dependencies in the final image
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production && yarn cache clean

# Compiled JS from the build stage
COPY --from=builder /app/dist ./dist

# Railway injects PORT at runtime; this is documentation only
EXPOSE 8082

CMD ["node", "dist/server.js"]
