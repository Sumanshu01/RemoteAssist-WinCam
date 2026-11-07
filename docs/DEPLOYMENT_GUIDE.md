# RemoteAssist WinCam — Production Deployment Guide

This guide details the end-to-end production deployment of **RemoteAssist WinCam**, including containerization, reverse proxy TLS termination, WebRTC STUN/TURN (coturn) traversal, and database scaling.

---

## 1. Production Architecture Overview

```
                      +------------------------------------------+
                      |         Internet Clients (WAN)           |
                      |   - Applicant in India (Browser)         |
                      |   - Specialist in Canada (Browser / Win) |
                      +------------------------------------------+
                                    |               |
                                    | HTTPS / WSS   | WebRTC UDP Media
                                    v               v
               +--------------------------+   +--------------------------+
               | Nginx / Caddy TLS Proxy  |   | coturn STUN/TURN Server  |
               | (Port 443 / SSL Term)    |   | (UDP 3478 & 49152-65535) |
               +--------------------------+   +--------------------------+
                      |                 |
     HTTP / WSS /api  |                 | Static SPA Bundles
                      v                 v
          +-----------------------+  +--------------------------+
          | Node.js Signaling Svc |  | Static Assets / CDN      |
          | (Port 4000)           |  | (Dashboard & Sender)     |
          +-----------------------+  +--------------------------+
                      |
                      v
          +-----------------------+
          | PostgreSQL 15+ DB     |
          | (State & Audit Logs)  |
          +-----------------------+
```

---

## 2. Docker Compose Deployment

A complete production stack can be orchestrated via `docker-compose.yml`:

```yaml
version: "3.8"

services:
  postgres:
    image: postgres:15-alpine
    restart: always
    environment:
      POSTGRES_DB: remoteassist_wincam
      POSTGRES_USER: ${POSTGRES_USER:-remoteassist}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U remoteassist -d remoteassist_wincam"]
      interval: 5s
      timeout: 5s
      retries: 5

  signaling:
    build:
      context: .
      dockerfile: services/signaling-server/Dockerfile
    restart: always
    environment:
      NODE_ENV: production
      PORT: 4000
      DATABASE_URL: postgresql://${POSTGRES_USER:-remoteassist}:${POSTGRES_PASSWORD}@postgres:5432/remoteassist_wincam?schema=public
      CORS_ORIGIN: https://assist.yourdomain.org,https://apply.yourdomain.org
      STUN_SERVER_URLS: ${STUN_SERVER_URLS}
      TURN_SERVER_URL: ${TURN_SERVER_URL}
      TURN_USERNAME: ${TURN_USERNAME}
      TURN_CREDENTIAL: ${TURN_CREDENTIAL}
    depends_on:
      postgres:
        condition: service_healthy
    ports:
      - "4000:4000"

  coturn:
    image: coturn/coturn:latest
    restart: always
    network_mode: host
    volumes:
      - ./turnserver.conf:/etc/turnserver.conf:ro

volumes:
  postgres_data:
```

---

## 3. WebRTC STUN & TURN Configuration (coturn)

For cross-border communication across unrelated commercial networks and symmetric mobile NATs, a dedicated TURN server is required.

### Recommended `turnserver.conf`:

```conf
listening-port=3478
tls-listening-port=5349
realm=turn.remoteassist-wincam.org
server-name=turn.remoteassist-wincam.org
fingerprint
lt-cred-mech
user=remoteassist_user:CHANGE_TO_HIGH_ENTROPY_SECRET
min-port=49152
max-port=65535
log-file=stdout
no-cli
no-tcp-relay
```

---

## 4. Reverse Proxy & TLS Termination (Nginx)

```nginx
server {
    listen 443 ssl http2;
    server_name assist.yourdomain.org;

    ssl_certificate /etc/letsencrypt/live/assist.yourdomain.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/assist.yourdomain.org/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Static Dashboard SPA
    location / {
        root /var/www/remoteassist/dashboard/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Signaling Server API & WebSocket Gateway
    location /socket.io/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

---

## 5. Database Migration Execution

Before serving traffic, execute the initial migration against the target database:

```bash
# Apply SQL migration directly:
psql "$DATABASE_URL" -f services/signaling-server/prisma/migrations/20261020000000_init/migration.sql

# Or using Prisma:
npx prisma migrate deploy --schema=services/signaling-server/prisma/schema.prisma
```

---

## 6. Production Security Hardening Checklist

- [x] **HTTPS / TLS Enforced**: All web traffic and WebSocket signaling encrypted via TLS 1.2+.
- [x] **CORS Domain Whitelist**: Configured to exact authorized hostnames; wildcard `*` strictly disabled.
- [x] **Secure Cookie Attributes**: `SameSite=Lax`, `Secure`, and `HttpOnly` applied to authentication tokens.
- [x] **Input Validation**: 100% of socket events and REST endpoints validated via Zod schemas.
- [x] **Sensitive Data Scrubbing**: Plaintext credentials, auth tokens, and PII automatically scrubbed from server logs.
- [x] **Consent Enforcement**: Ingress video frames dropped until mutual consent agreement is active.
- [x] **Zero Persistent Recording**: Media streams discarded immediately after volatile presentation.
- [x] **Database Isolation**: Foreign key cascades and role-based applicant isolation active.
