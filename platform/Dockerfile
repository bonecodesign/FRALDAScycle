FROM node:20-alpine AS runtime
WORKDIR /srv/fraldacycle/platform
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY apps ./apps
COPY database ./database
COPY workers ./workers
COPY packages ./packages
COPY docs/legal ./docs/legal
USER node
EXPOSE 4200
CMD ["node", "apps/api/runtime.js"]
