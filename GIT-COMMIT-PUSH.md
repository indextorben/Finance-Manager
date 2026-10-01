# Änderungen committen und zu GitHub pushen

Diese Anleitung beschreibt den üblichen Ablauf, um lokale Änderungen im Finance-Manager-Repository zu prüfen, zu committen und auf den Branch `main` bei GitHub zu pushen.

## Projektordner mit dem Repository aktualisieren

Mit diesen Schritten wird der lokale Projektordner auf den aktuellen Stand von `origin/main` gebracht.

### 1. Projektordner öffnen

```bash
cd /pfad/zum/Finance-Manager
```

### 2. Lokalen Status prüfen

```bash
git status
```

Wenn keine lokalen Änderungen vorhanden sind, kann der aktuelle Stand direkt heruntergeladen werden.

### 3. Änderungen vom Repository übernehmen

```bash
git pull --ff-only origin main
```

`--ff-only` verhindert, dass Git beim Pull automatisch einen unerwarteten Merge-Commit erstellt.

### 4. Aktualisierung kontrollieren

```bash
git status
git log -1 --oneline --decorate
```

Der lokale Branch sollte anschließend mit `origin/main` übereinstimmen.

### Kompakter Pull-Ablauf

```bash
cd /pfad/zum/Finance-Manager
git status
git pull --ff-only origin main
git log -1 --oneline --decorate
```

### Falls lokale Änderungen vorhanden sind

Lokale Änderungen sollten vor dem Pull entweder committet oder vorübergehend gesichert werden.

Änderungen zuerst committen:

```bash
git add DATEINAME
git commit -m "Beschreibung der lokalen Änderung"
git pull --rebase origin main
```

Alternativ Änderungen vorübergehend sichern:

```bash
git stash push -m "Lokale Änderungen vor Pull"
git pull --ff-only origin main
git stash pop
```

Nach `git stash pop` können Konflikte auftreten, wenn lokal und im Repository dieselben Stellen geändert wurden. Diese Konflikte müssen vor dem nächsten Commit manuell gelöst werden.

### Docker-Anwendung nach dem Pull aktualisieren

Ein Pull aktualisiert nur die Dateien im Projektordner. Damit der laufende Docker-Container die neue Version verwendet, anschließend ausführen:

```bash
APP_COMMIT=$(git rev-parse HEAD) sudo docker compose up -d --build app
```

Weitere Hinweise dazu stehen in [PI-UPDATE.md](PI-UPDATE.md).

## 1. Projektordner öffnen

Im Terminal in den Projektordner wechseln:

```bash
cd /pfad/zum/Finance-Manager
```

## 2. Änderungen prüfen

Status des Repositorys anzeigen:

```bash
git status
```

Inhaltliche Änderungen ansehen:

```bash
git diff
```

## 3. Dateien zum Commit hinzufügen

Am sichersten ist es, die gewünschten Dateien einzeln anzugeben:

```bash
git add PI-UPDATE.md
```

Mehrere bestimmte Dateien können gemeinsam hinzugefügt werden:

```bash
git add src/app.js src/views/account.ejs
```

Wenn wirklich alle angezeigten Änderungen in denselben Commit gehören:

```bash
git add -A
```

## 4. Vorgemerkte Änderungen kontrollieren

Anzeigen, welche Dateien im Commit enthalten sein werden:

```bash
git status
git diff --cached
```

Auf problematische Leerzeichen oder Formatierungsfehler prüfen:

```bash
git diff --cached --check
```

## 5. Commit erstellen

Eine kurze und aussagekräftige Commit-Nachricht verwenden:

```bash
git commit -m "Add Raspberry Pi update guide"
```

Beispiele für weitere Commit-Nachrichten:

```bash
git commit -m "Add password confirmation to account settings"
git commit -m "Fix account validation"
git commit -m "Update deployment documentation"
```

## 6. Änderungen vom Remote-Repository übernehmen

Vor dem Push den aktuellen Stand von `main` integrieren:

```bash
git pull --rebase origin main
```

Wenn Konflikte auftreten, diese zuerst in den betroffenen Dateien lösen. Danach:

```bash
git add DATEINAME
git rebase --continue
```

## 7. Commit zu GitHub pushen

```bash
git push origin main
```

## 8. Ergebnis kontrollieren

```bash
git status
git log -1 --oneline --decorate
```

Bei einem erfolgreichen Push sollte `git status` melden, dass der lokale Branch mit `origin/main` übereinstimmt und keine Änderungen vorhanden sind.

## Kompakter Standardablauf

```bash
git status
git diff
git add DATEINAME
git diff --cached --check
git diff --cached
git commit -m "Kurze Beschreibung der Änderung"
git pull --rebase origin main
git push origin main
git status
```

## Bereits vorgemerkte Datei wieder entfernen

Falls eine Datei versehentlich mit `git add` vorgemerkt wurde, bleibt ihr Inhalt mit diesem Befehl erhalten, sie wird aber aus dem geplanten Commit entfernt:

```bash
git restore --staged DATEINAME
```

## Wichtig

- Keine Passwörter, Tokens, privaten Schlüssel oder ausgefüllten `.env`-Dateien committen.
- Vor `git add -A` immer mit `git status` kontrollieren, welche Dateien verändert wurden.
- Keine fremden oder nicht verstandenen Änderungen in den eigenen Commit aufnehmen.
- `git push --force` auf `main` vermeiden, da damit Änderungen anderer überschrieben werden können.
