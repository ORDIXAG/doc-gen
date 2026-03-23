# =======================================================
# Frontend container
# Runs Angular dev server via `npm run start`
# =======================================================

FROM node:24-slim

WORKDIR /app

# Copy only dependency files first for caching
COPY package.json package-lock.json ./

RUN npm ci

# Copy the rest of the frontend source
COPY . .

ENV HOST=0.0.0.0 \
    PORT=4200

EXPOSE 4200

# Bind to all interfaces so Docker port mapping works
CMD ["npm", "run", "start", "--", "--host", "0.0.0.0", "--port", "4200"]
