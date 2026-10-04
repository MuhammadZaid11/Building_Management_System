FROM node:22-alpine

WORKDIR /app

COPY backend/package.json backend/package-lock.json ./
COPY backend/prisma ./prisma
RUN npm ci && npx prisma generate && touch node_modules/.docker-ready

COPY backend/ ./

EXPOSE 3000

ENTRYPOINT ["sh", "-c", "if [ ! -d node_modules/bcryptjs ] || [ ! -d node_modules/@prisma/client ] || [ package-lock.json -nt node_modules/.docker-ready ]; then npm ci && touch node_modules/.docker-ready; fi; npx prisma generate; exec \"$@\"", "--"]
CMD ["npm", "run", "dev"]
