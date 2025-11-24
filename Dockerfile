# Dockerfile

# 1. 依存関係のインストール (depsステージ)
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# 2. ビルド (builderステージ)
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 本番用の環境変数をビルド時に焼き込むため、.env.localをコピー
# ※注意: .env.local には本番用のAPIキーなどを記述しておくこと
COPY .env.local .env.production

# ビルド実行
# NEXT_PUBLIC_ 系の環境変数はこのタイミングで置換されます
RUN npm run build

# 3. 実行用イメージ (runnerステージ)
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# セキュリティのため非rootユーザーを作成
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# スタンドアロンビルドの成果物をコピー
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]