# ビルドステージ
FROM --platform=linux/amd64 node:18-alpine AS builder

WORKDIR /app

# 依存関係のファイルをコピー
COPY package*.json ./
COPY tsconfig.json ./

# 依存関係をインストール
RUN npm ci

# ソースコードをコピー
COPY src ./src

# TypeScriptをビルド
RUN npm run build

# 本番ステージ
FROM --platform=linux/amd64 node:18-alpine

WORKDIR /app

# curlをインストール（ヘルスチェック用）
RUN apk add --no-cache curl

# 本番用の依存関係のみインストール
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# ビルドされたファイルをコピー
COPY --from=builder /app/dist ./dist

# 非rootユーザーを作成
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# ユーザーを切り替え
USER nodejs

# ポートを公開
EXPOSE 8000

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# アプリケーションを起動
CMD ["node", "dist/index.js"]