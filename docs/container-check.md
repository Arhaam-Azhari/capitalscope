# My container verification

I build the real multi-stage Dockerfile and check both supported database launch paths in the Backend checks workflow. I keep this separate from the portfolio release's initial jar verification.

```bash
docker build --tag capitalscope:container-check .
bash scripts/check-container.sh capitalscope:container-check
```

I need Docker with the Compose plugin, Node.js 22, curl, and free local ports 8080 and 8098. I run this with no SEC identity or price-provider key. I use uniquely named disposable containers, networks, and volumes, and remove those check resources when the script exits. I do not run it against my normal saved-work volumes.

## What I check

- I start the image as user 10001 with its default file-backed H2 database in a fresh named volume at `/app/data`.
- I read the packaged dashboard asset, the 50-company catalog, and labeled example facts. I check the $90 valuation and explicit failures for unconfigured real-company providers.
- I save a fictional portfolio and one simulated buy. I check $800 remaining cash and 10 DEMO shares, recreate the container against the same volume, and reopen the saved cash, holding, and fill.
- I run the existing Compose configuration with PostgreSQL 17 and the same built image. I create another portfolio/fill, bring the stack down without removing its volume, recreate it, and reopen the saved state.

I prepare `/app/data` for the non-root runtime user in the image. I exclude locally generated static assets from the Docker build context so the web build supplies the packaged dashboard.

## My scope

I run these checks in CI because Docker is unavailable in the local release environment. This covers image build, startup, non-root data writes, packaged APIs/assets, and persistence across recreation with named volumes. It does not establish live-provider coverage, public-hosting readiness, backup/restore recovery, or private user accounts.

I keep the Compose port bound to localhost. My normal Compose data remains in its `research-data` volume. I avoid `docker compose down --volumes` on my normal workspace when I want to keep saved records; the check script removes only its own uniquely named test resources.
