FROM node:20-alpine AS runtime
WORKDIR /srv/fraldacycle/platform
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    npm ci --omit=dev --ignore-scripts --strict-ssl=true
COPY apps ./apps
COPY database ./database
COPY workers ./workers
COPY packages ./packages
COPY docs/legal ./docs/legal
USER node
EXPOSE 4200
CMD ["node", "apps/api/runtime.js"]
