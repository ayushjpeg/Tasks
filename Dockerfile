# syntax=docker/dockerfile:1.6
FROM node:20-alpine AS build
ARG VITE_API_BASE_URL
ARG VITE_API_KEY
ARG VITE_GEMINI_API_KEY
ARG VITE_GEMINI_MODEL
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_API_KEY=${VITE_API_KEY}
ENV VITE_GEMINI_API_KEY=${VITE_GEMINI_API_KEY}
ENV VITE_GEMINI_MODEL=${VITE_GEMINI_MODEL}
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
RUN npm install -g serve
COPY --from=build /app/dist ./dist
EXPOSE 8006
CMD ["serve", "-s", "dist", "-l", "8006"]
