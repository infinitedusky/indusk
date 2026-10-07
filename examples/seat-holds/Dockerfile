# The seat-holds example as a container: the page on 8080, its spans sent to
# whatever OTEL_EXPORTER_OTLP_ENDPOINT names (your project's InDusk server).
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund --loglevel=error
COPY src ./src
COPY public ./public
ENV PORT=8080 SEAT_HOLDS_ENV=production
EXPOSE 8080
CMD ["npm", "start", "--silent"]
