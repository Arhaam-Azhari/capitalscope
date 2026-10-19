# My PostgreSQL backup and restore route

I use these scripts for the `capitalscope` database and user in the supplied Compose configuration. I create a custom-format PostgreSQL archive containing the application schema and data; I do not use a CSV export as a database backup. I test PostgreSQL 17 restoring to PostgreSQL 17 with the same app version.

## I create a backup

I run from the repository root with my normal Compose database running:

```bash
mkdir -p backups
db_container="$(docker compose ps --quiet db)"
bash scripts/backup-postgres.sh "$db_container" backups/my-research.dump
```

I choose a new filename each time. The script refuses an existing destination, writes a private temporary file, checks the archive header, and publishes it without replacing an existing file. If dumping or checking fails, I leave no completed backup at that path. I keep the backup on the same filesystem as its temporary file.

I treat the archive as saved-work data: it can contain theses, risks, revision history, valuations, portfolios, and cached provider data. I keep the default `backups/` directory out of git and the Docker build context. I store important copies separately from the database volume; I do not treat two files on the same disk as disaster recovery.

## I restore into a separate empty database

I keep the source workspace intact. I use the same checkout/app version and my normal `.env` database password, but a new Compose project name gives the target its own volume. I choose a project name I have not already used for saved work.

```bash
COMPOSE_PROJECT_NAME=capitalscope-restored docker compose up --detach db
restored_db="$(COMPOSE_PROJECT_NAME=capitalscope-restored docker compose ps --quiet db)"
bash scripts/restore-postgres.sh backups/my-research.dump "$restored_db"
```

I wait until PostgreSQL is healthy before running the restore script. I keep the target app stopped while restoring. The script refuses a target with user tables, views, or sequences and restores in one transaction with errors stopping the restore. I restore only archives I trust; this is not a file-upload feature or an importer for arbitrary SQL.

After restoring, I free localhost port 8080 by stopping my original app, then start the restored app:

```bash
docker compose stop app
COMPOSE_PROJECT_NAME=capitalscope-restored docker compose up --detach --build app
```

I reopen http://localhost:8080 and inspect my saved research, valuations, and simulated holdings. I do not remove the source volume during this check. If I want to return to the source app, I stop the restored app first and run `docker compose up --detach app` without the restored project name. I keep both sets of volumes until I have decided which workspace to retain.

## What I verify in CI

I extend `scripts/check-container.sh` to create a portfolio/fill, saved thesis with revisions, and a saved valuation case. I dump the running Compose/PostgreSQL database, check that overwriting a backup and restoring into the nonempty source are refused, then restore into a fresh PostgreSQL volume on a separate network. I start another app instance against that restored database and compare the original cash, shares, fill, thesis, revision records, and valuation case through the APIs.

I remove only the check's uniquely named disposable resources. Docker is unavailable locally, so CI executes the actual archive/restore round trip; I separately exercise the saved-record verification against the packaged app locally.

## My limits

I transfer browser-local notes separately: in Research notes I open Back up or restore this note and download its JSON backup. On the same company in another browser, I choose the file, review the preview, choose Restore into editor, then Save note. Reading a file leaves my editor unchanged; restoring replaces the editor draft but preserves the saved note until I save. I export one company’s note at a time, including any current unsaved edits. I can cancel a preview or discard a restored draft. I keep private research in these files private and treat their metadata as unverified labels.

I verify a logical database restore, not off-site storage, automated retention, encryption, point-in-time recovery, or cross-version migration. My database archives exclude browser-local notes and unsaved drafts, because they are outside PostgreSQL. For the standalone H2 launch, I keep a stopped-app copy of the full data directory; the PostgreSQL scripts do not accept H2 files, and this CI check does not establish an H2 backup/restore route.
