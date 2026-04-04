# Architecture

## Environment Management

This project uses [composable.env](https://www.npmjs.com/package/composable.env) to manage environment variables across all services.

- **Components** define values (`env/components/*.env`)
- **Contracts** declare what each service needs (`env/contracts/*.contract.json`)
- **Profiles** switch between environments (`env/profiles/*.json`)

`pnpm ce env:build` generates `.env` files and `docker-compose.yml` from these sources.

## Docker

All services run in Docker via `docker compose`. The compose file is fully generated — never hand-edit it.

```bash
pnpm ce env:build    # generate all outputs
pnpm ce dc:up local  # start local environment
```
