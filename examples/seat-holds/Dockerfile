# promise: the-deployed-demo-page-answers
# The seat-holds example as a container: the page on 8080, its spans sent to
# whatever OTEL_EXPORTER_OTLP_ENDPOINT names (your project's InDusk server).
FROM node:24-slim
WORKDIR /app
COPY package.json ./
# Node 24 for npm 11: npm 10 fails to install this tree ("Cannot read
# properties of null (reading 'edgesOut')").
RUN npm install --omit=dev --no-audit --no-fund --loglevel=error
COPY src ./src
COPY public ./public
ENV NODE_ENV=production PORT=8080 SEAT_HOLDS_ENV=production
EXPOSE 8080
CMD ["npm", "start", "--silent"]
