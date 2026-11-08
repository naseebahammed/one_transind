FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=production
EXPOSE 3000
# Database settings are NOT baked in: pass them at run time with --env-file
CMD ["npm", "run", "start"]
