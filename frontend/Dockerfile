# --- Build stage ---
# Align Node base with the backend (node:22-alpine) for a single toolchain.
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
# npm ci installs exactly from the lockfile for reproducible builds.
RUN npm ci
COPY . .
RUN npm run build

# --- Serve stage ---
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
