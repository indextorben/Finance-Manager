# Finance Manager

Lokale Finanzverwaltung mit Node.js/Express, PostgreSQL, Bootstrap 5 und Chart.js.

## Schnellstart

```bash
cp .env.example .env
docker compose up --build
```

Danach: `http://localhost:3000`

### Initialer Administrator

- Benutzer: `Torben`
- Initialpasswort: `Start-Finance-2026!`
- E-Mail: `torben@localhost`

Beim ersten Login wird Torben zwingend auf die Seite **Initialpasswort ändern** weitergeleitet. Erst danach ist das Dashboard erreichbar. Das Initialpasswort kann vor dem ersten Start über `INITIAL_ADMIN_PASSWORD` in `.env` geändert werden.

## Mailpit / Passwort vergessen

Lokale Test-Mails: `http://localhost:8025`. SMTP wird über Environment-Variablen konfiguriert.

## Sauberer Neustart mit neuer Datenbank

Nur wenn vorhandene Testdaten vollständig gelöscht werden sollen:

```bash
docker compose down -v
docker compose up --build
```

`-v` löscht das PostgreSQL-Volume und damit alle vorhandenen Daten.

## Datenbank

PostgreSQL läuft intern als `finance_manager`. Migrationen werden beim Containerstart ausgeführt. Geldwerte werden als `NUMERIC` gespeichert. Die Views unter `database/views/` sind für spätere BI-/Superset-Abfragen vorbereitet.

## Backup

```bash
docker compose exec db pg_dump -U finance -d finance_manager > finance-backup.sql
```

Restore in eine leere Datenbank:

```bash
cat finance-backup.sql | docker compose exec -T db psql -U finance -d finance_manager
```

## Automatische Update-Prüfung

Der Finance Manager prüft nach dem Start und anschließend standardmäßig alle sechs Stunden den Branch `main` des konfigurierten GitHub-Repositories. Administratoren sehen unter **Updates** den installierten und den neuesten Commit. Wenn eine neue Version verfügbar ist, erscheint zusätzlich ein Hinweis in der Kopfzeile.

Die Prüfung wird über `UPDATE_REPO`, `UPDATE_BRANCH` und `UPDATE_CHECK_INTERVAL_MINUTES` konfiguriert. Für private Repositories kann ein GitHub-Token mit reinen Leserechten als `GITHUB_TOKEN` hinterlegt werden. Updates werden bewusst nicht unbeaufsichtigt installiert; die Update-Seite zeigt die sicheren Befehle zum Aktualisieren des Docker-Deployments.

## Entwicklung

Die Anwendung verwendet Argon2id, serverseitige Sessions in PostgreSQL, CSRF-Prüfung, Helmet/CSP, Rate Limiting, parametrisierte SQL-Abfragen und geschützte Upload-Routen. Vor einem öffentlichen Produktivbetrieb müssen Secrets ersetzt, HTTPS aktiviert, Berechtigungen geprüft und vollständige E2E-/Security-Tests durchgeführt werden.


## V3 – lokale Asset-/HTTPS-Korrektur

In der Entwicklungsumgebung werden HSTS und `upgrade-insecure-requests` bewusst nicht gesetzt. Dadurch lädt `http://localhost:3000` die lokal ausgelieferten Bootstrap-, Bootstrap-Icons-, GridStack-, Chart.js- und App-Assets zuverlässig über HTTP. In `NODE_ENV=production` bleiben die HTTPS-Sicherheitsmechanismen aktiv.

Diagnose nach dem Start:

```bash
curl -i http://localhost:3000/health
curl -I http://localhost:3000/assets/bootstrap/css/bootstrap.min.css
curl -I http://localhost:3000/css/app.css
```

`/health` soll `{"ok":true,"database":"ok"}` liefern; beide Asset-Aufrufe sollen HTTP 200 zurückgeben.

## Änderungen in V4
- Sidebar ist scrollbar und für normale Browser-Zoomstufen kompakter; Analyse/Administration bleiben erreichbar.
- Oberfläche und Formularbeschriftungen wurden weiter auf Deutsch vereinheitlicht.
- Konten besitzen eine eigene Verwaltung mit Anfangssaldo/Startkapital und berechnetem aktuellem Saldo.
- Einnahmen (`/income`) und Ausgaben (`/expenses`) sind eigenständige Bereiche mit jeweils passender Erfassungsmaske und gefilterter Liste.
