# Finance Manager auf dem Raspberry Pi aktualisieren

Ein `git pull` aktualisiert nur die Dateien im Projektordner. Da der Finance Manager in einem Docker-Container läuft, muss anschließend auch das App-Image neu gebaut und der Container neu gestartet werden.

## Reguläres Update

Im Projektordner des Finance Managers ausführen:

```bash
git pull --ff-only origin main
APP_COMMIT=$(git rev-parse HEAD) sudo docker compose up -d --build app
```

`APP_COMMIT` sorgt dafür, dass die installierte Version auf der Update-Seite korrekt angezeigt wird.

## Aktualisierung prüfen

Containerstatus anzeigen:

```bash
sudo docker compose ps
```

Prüfen, ob die Passwortbestätigung im laufenden Container vorhanden ist:

```bash
sudo docker compose exec app grep -n confirm_password /app/src/views/account.ejs
```

Falls eine Zeile mit `confirm_password` ausgegeben wird, enthält der laufende Container die neue Version.

## Falls weiterhin die alte Version angezeigt wird

Das App-Image einmal ohne Docker-Build-Cache neu erstellen:

```bash
APP_COMMIT=$(git rev-parse HEAD) sudo docker compose build --no-cache app
sudo docker compose up -d app
```

Anschließend die Seite im Browser vollständig neu laden.

## Wichtig: Daten nicht löschen

Für ein normales Update niemals diesen Befehl verwenden:

```bash
sudo docker compose down -v
```

Die Option `-v` entfernt die Docker-Volumes und kann dadurch die PostgreSQL-Datenbank sowie gespeicherte Uploads löschen.
