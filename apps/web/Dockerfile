# syntax=docker/dockerfile:1.7

FROM node:22.23.1-bookworm-slim AS base

ENV NEXT_TELEMETRY_DISABLED=1 \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_UPDATE_NOTIFIER=false

WORKDIR /app

FROM base AS dependencies

COPY package.json package-lock.json ./
RUN npm ci

FROM base AS build

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WEB_URL
ARG NEXT_PUBLIC_WHATSAPP_PHONE
ARG NEXT_PUBLIC_STORE_ADDRESS
ARG NEXT_PUBLIC_CONTACT_EMAIL
ARG NEXT_PUBLIC_GA_MEASUREMENT_ID
ARG API_INTERNAL_URL=http://127.0.0.1:9/api/v1

ENV API_INTERNAL_URL=${API_INTERNAL_URL} \
    NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_PUBLIC_WEB_URL=${NEXT_PUBLIC_WEB_URL} \
    NEXT_PUBLIC_WHATSAPP_PHONE=${NEXT_PUBLIC_WHATSAPP_PHONE} \
    NEXT_PUBLIC_STORE_ADDRESS=${NEXT_PUBLIC_STORE_ADDRESS} \
    NEXT_PUBLIC_CONTACT_EMAIL=${NEXT_PUBLIC_CONTACT_EMAIL} \
    NEXT_PUBLIC_GA_MEASUREMENT_ID=${NEXT_PUBLIC_GA_MEASUREMENT_ID}

RUN npm run build

FROM base AS runtime

ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000

COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
