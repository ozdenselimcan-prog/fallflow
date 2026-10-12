# Datenbank-Backup

Jede Nacht (02:30 UTC) sichert der GitHub-Workflow `.github/workflows/db-backup.yml` die Supabase-Datenbank
(Fälle, Nachrichten, Einstellungen, Benutzerkonten) und verschlüsselt sie mit `BACKUP_PASSPHRASE` (AES-256).
Die Sicherungen liegen 90 Tage unter **GitHub → Actions → Datenbank-Backup → Lauf → Artifacts**.

Nicht enthalten sind die hochgeladenen Dateien (PDFs, Fotos) – die liegen im Supabase-Speicher.

## Einrichten

1. Supabase → Projekt → **Connect** → **Session pooler** → Verbindungsadresse kopieren und `[YOUR-PASSWORD]`
   durch das Datenbank-Passwort ersetzen (Supabase → Project Settings → Database → Reset database password,
   falls unbekannt).
2. GitHub → Repository → **Settings → Secrets and variables → Actions → New repository secret**:
   - `SUPABASE_DB_URL` = die Adresse aus Schritt 1
   - `BACKUP_PASSPHRASE` = ein langes, selbst gewähltes Passwort (sicher aufbewahren – ohne es ist das Backup wertlos)
3. GitHub → **Actions → Datenbank-Backup → Run workflow**, um die erste Sicherung sofort zu testen.

## Wiederherstellen

```bash
gpg --decrypt --output fallflow.dump fallflow-JJJJ-MM-TT.dump.gpg     # fragt nach BACKUP_PASSPHRASE
pg_restore --no-owner --no-privileges --clean --if-exists --dbname "<SUPABASE_DB_URL>" fallflow.dump
```

Vor einer Wiederherstellung in die Live-Datenbank am besten erst in ein neues, leeres Supabase-Projekt einspielen
und prüfen.
