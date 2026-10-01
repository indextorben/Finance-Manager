FROM node:22-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
ARG APP_COMMIT=unknown
RUN node -e "require('fs').writeFileSync('.build-info.json',JSON.stringify({commit:process.env.APP_COMMIT,builtAt:new Date().toISOString()}))"
RUN mkdir -p uploads && chown -R node:node /app
USER node
EXPOSE 3000
CMD ["sh","-c","node scripts/migrate.js && node scripts/initial-admin.js && node src/app.js"]
