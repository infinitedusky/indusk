# Docker

You are working with Docker in this project. Follow these patterns.

## Dockerfiles

- Use multi-stage builds: build stage for compilation, runtime stage for the final image
- Pin base image versions: `node:22-alpine`, not `node:latest`
- Copy `package.json` and lockfile first, install deps, then copy source — this maximizes layer caching
- Use `.dockerignore` to exclude `node_modules`, `.git`, `dist`, test files
- Run as non-root user in production: `USER node`

## Docker Compose

- Use named volumes for persistent data — not bind mounts for databases
- Use `depends_on` with health checks for service ordering
- Keep environment variables in `.env` files, not hardcoded in compose
- Use `restart: unless-stopped` for services that should survive reboots

## Image Size

- Use Alpine-based images when possible — `node:22-alpine` not `node:22`
- Remove build dependencies after compilation: `npm prune --production`
- Don't include development tools in production images
- Use `COPY --from=build` to copy only compiled artifacts

## Common Gotchas

- `COPY . .` invalidates the cache whenever any file changes — copy selectively
- `npm install` inside Docker ignores your lockfile by default — use `npm ci`
- Alpine uses musl libc, not glibc — some native modules (like sharp, bcrypt) need different builds
- Docker Desktop on Mac has slower file I/O than Linux — use volumes, not bind mounts for node_modules
- Don't store secrets in Docker images or environment variables in Dockerfiles — use runtime secrets
