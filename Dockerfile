FROM node:22-alpine AS deps

RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder

RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL:-mysql://dummy:dummy@localhost:3306/dummy}

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runner

RUN apk add --no-cache libc6-compat openssl python3
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV APP_HOST=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
  && npm cache clean --force

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/src/scripts ./src/scripts
COPY --from=builder /app/server.js ./server.js

USER nextjs
EXPOSE 3000
CMD ["npm", "run", "start"]
