FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production

# runtime dependencies only. --ignore-scripts: better-sqlite3 ships prebuilt binaries inside the package, so no compiler/Python is needed
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY server ./server
COPY public ./public

# the SQLite database + uploaded backgrounds live in /data — mount a persistent volume here
ENV PORT=3000 DATA_DIR=/data TRUST_PROXY=1
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://localhost:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "server/index.js"]
