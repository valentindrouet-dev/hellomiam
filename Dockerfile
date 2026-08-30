# ——— Étape 1 : build du client ———
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
RUN npm ci
COPY . .
RUN npm run build

# ——— Étape 2 : image finale (serveur + client compilé) ———
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
ENV DATA_DIR=/data
ENV PORT=3000

COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --omit=dev -w server && npm cache clean --force

COPY server/src server/src
COPY client/src/lib client/src/lib
COPY --from=build /app/client/dist client/dist

# Les données (base SQLite + photos) vivent dans /data : monter un volume ici.
VOLUME /data
EXPOSE 3000

CMD ["node", "server/src/index.js"]
