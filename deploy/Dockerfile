# Дзвінка на власному сервері.
#
# Збірка й віддача розділені: перший поверх має Node і всі залежності,
# другий — тільки Caddy й готові файли. У кінцевому образі немає ані
# node_modules, ані вихідників, ані самого Node.
#
#   docker compose -f deploy/compose.yml up -d --build
#
# Збирається з кореня репозиторію:
#   docker build -f deploy/Dockerfile -t dzvinka .

FROM node:24-alpine AS build
WORKDIR /app

# Спершу лише маніфести: доки залежності не мінялись, цей шар береться
# з кеша й `npm ci` не запускається взагалі.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# BASE_PATH=/ — бо на власному домені застосунок живе в корені, а не в
# підпапці з назвою репозиторію, як на GitHub Pages.
ENV BASE_PATH=/
RUN npm run build


FROM caddy:2-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
