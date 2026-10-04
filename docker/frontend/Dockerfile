FROM node:22-alpine

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci && touch node_modules/.docker-ready

COPY frontend/ ./

EXPOSE 5173

ENTRYPOINT ["sh", "-c", "if [ ! -d node_modules/axios ] || [ ! -d node_modules/react-router-dom ] || [ package-lock.json -nt node_modules/.docker-ready ]; then npm ci && touch node_modules/.docker-ready; fi; exec \"$@\"", "--"]
CMD ["npm", "run", "dev"]
