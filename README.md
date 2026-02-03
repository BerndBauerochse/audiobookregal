<div align="center">
  <img src="client/static/icon.svg" alt="Audiohub Logo" width="120">
  <h1>Audiohub</h1>
  <p><strong>Datenschutzfreundlicher Audiobook-Server</strong></p>
  <p>Ein Privacy-fokussierter Fork von <a href="https://github.com/advplyr/audiobookshelf">Audiobookshelf</a></p>
</div>

---

## Über Audiohub

Audiohub ist ein selbstgehosteter Hörbuch- und Podcast-Server mit erweitertem Datenschutz. Basierend auf Audiobookshelf, wurde diese Version speziell für DSGVO-Konformität und Privatsphäre angepasst.

## Privacy-Funktionen

### 🔒 Anonymisierte Gerätedaten
- Geräte-IDs werden gehasht und nicht im Klartext gespeichert
- Betriebssystem-Versionen werden generalisiert
- Keine detaillierten Geräte-Fingerprints

### 👁️ Eingeschränkte Admin-Einsicht
- Admins sehen nur Online/Offline-Status der Benutzer
- Keine detaillierten Aktivitätsprotokolle sichtbar
- Session-Details sind anonymisiert

### 🏷️ Tags nur für Admins
- Tags sind nur für Admin-Benutzer sichtbar
- Gäste und normale Benutzer sehen keine Tags in Suche/Filter
- Verhindert ungewollte Kategorisierung für Endbenutzer

### 📋 DSGVO-Funktionen
- **Datenexport (Art. 20 DSGVO):** Benutzer können ihre Daten als TXT-Datei exportieren
- **Datenlöschung (Art. 17 DSGVO):** Benutzer können ihre Aktivitätsdaten selbst löschen
- Exportierte Daten enthalten: Hörfortschritt, Lesezeichen, Einstellungen

### ⚖️ Rechtliche Seiten
- Impressum-Link auf der Login-Seite
- Lokale Datenschutzerklärung unter `/datenschutz`
- Konfigurierbare Links zu externen Rechtstexten

---

## Installation

### Voraussetzungen
- Docker und Docker Compose
- Git

### Schnellstart

```bash
# Repository klonen
git clone https://github.com/BerndBauerochse/audiobookregal.git
cd audiobookregal

# Zum Privacy-Branch wechseln
git checkout claude/privacy-rebrand-audiobookshelf-1KVaX

# Docker Container bauen und starten
docker compose build --no-cache
docker compose up -d
```

### Zugriff
Nach dem Start ist Audiohub unter `http://localhost:13378` erreichbar.

### Daten-Verzeichnisse
Passen Sie die Volumes in `docker-compose.yml` an:
```yaml
volumes:
  - /pfad/zu/config:/config
  - /pfad/zu/hoerbuecher:/audiobooks
  - /pfad/zu/podcasts:/podcasts
```

---

## Konfiguration

### Datenschutz-Seite anpassen
Die Datenschutzerklärung befindet sich unter:
```
client/static/datenschutz.html
```

### Impressum-Link ändern
In `client/pages/login.vue` den Link anpassen:
```html
<a href="https://ihre-domain.de/impressum/" target="_blank">Impressum</a>
```

---

## Benutzer-Funktionen

### Daten exportieren
1. Einloggen → Konto-Einstellungen
2. Bereich "Datenschutz & Daten"
3. Button "Meine Daten exportieren"
4. TXT-Datei wird heruntergeladen

### Daten löschen
1. Einloggen → Konto-Einstellungen
2. Bereich "Datenschutz & Daten"
3. Button "Meine Daten löschen"
4. Bestätigung → Alle Aktivitätsdaten werden gelöscht

---

## Unterschiede zum Original

| Funktion | Audiobookshelf | Audiohub |
|----------|---------------|----------|
| Geräte-IDs | Klartext | Gehasht |
| Admin Session-Einsicht | Vollständig | Nur Online/Offline |
| Tags für Gäste | Sichtbar | Versteckt |
| DSGVO Datenexport | ❌ | ✅ |
| DSGVO Datenlöschung | ❌ | ✅ |
| Datenschutz-Seite | ❌ | ✅ |
| Impressum-Link | ❌ | ✅ |

---

## Technische Details

### Geänderte Dateien
- `server/utils/DeviceInfo.js` - Geräte-Anonymisierung
- `server/controllers/SessionController.js` - Session-Privacy
- `server/controllers/MeController.js` - DSGVO-Endpunkte
- `server/utils/queries/libraryFilters.js` - Tags nur für Admins
- `client/pages/account.vue` - Export/Lösch-Buttons
- `client/pages/login.vue` - Rechtliche Links
- `client/static/datenschutz.html` - Datenschutzerklärung

### API-Endpunkte
- `GET /api/me/data-export` - Exportiert Benutzerdaten
- `DELETE /api/me/data` - Löscht Benutzer-Aktivitätsdaten

---

## Lizenz

Dieses Projekt basiert auf [Audiobookshelf](https://github.com/advplyr/audiobookshelf) und steht unter der gleichen Lizenz.

## Credits

- Original: [advplyr/audiobookshelf](https://github.com/advplyr/audiobookshelf)
- Privacy-Fork: Der Audio Verlag (DAV)
