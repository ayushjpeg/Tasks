# syntax=docker/dockerfile:1.6
FROM node:20-alpine AS build
ARG BACKEND_URL=https://common-backend.ayux.in/api
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ENV VITE_BACKEND_URL=${BACKEND_URL}
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
RUN npm install -g serve
COPY --from=build /app/dist ./dist
EXPOSE 8006
CMD ["serve", "-s", "dist", "-l", "8006"]
