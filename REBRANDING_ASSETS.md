# Rebranding Assets Guide

This document lists all assets that need to be replaced for custom branding of this privacy-focused Audiobookshelf fork.

## Logo & Icon Files (Replace with your custom assets)

### Primary Logo Files
| File | Description | Dimensions |
|------|-------------|------------|
| `client/static/Logo.png` | Main logo displayed in UI | Variable |
| `client/static/icon.svg` | SVG vector icon (login page, etc.) | Scalable |
| `client/static/favicon.ico` | Browser favicon | 16x16, 32x32 |

### PWA & Mobile Icons
| File | Description | Dimensions |
|------|-------------|------------|
| `client/static/icon192.png` | PWA icon (large) | 192x192 |
| `client/static/icon64.png` | Medium icon | 64x64 |
| `client/static/icon48.png` | Small icon | 48x48 |
| `client/static/ios_icon.png` | iOS home screen icon | 180x180 (recommended) |

## Text Branding Locations

### Files to Update
1. **`client/pages/login.vue`** - Login page heading ("audiobookshelf")
2. **`client/nuxt.config.js`** - App title and meta tags
3. **`package.json`** - Package name and description
4. **`server/Server.js`** - Server status endpoint app name

## Placeholder Images
| File | Description |
|------|-------------|
| `client/static/book_placeholder.jpg` | Default book cover (optional rebrand) |

## How to Rebrand

1. **Replace Image Files**: Create your custom logo/icon assets matching the dimensions above and replace the files in `client/static/`

2. **Update Text References**: Search for "audiobookshelf" in the codebase and replace with your custom name

3. **Rebuild Client**: After replacing assets, rebuild the Nuxt client:
   ```bash
   cd client && npm run build
   ```

## Privacy Branding Suggestions

Consider naming your fork to reflect its privacy-focused nature, such as:
- "PrivateShelf"
- "AudioVault"
- "SecureBooks"
- "LibraryPrivate"

This helps users identify that they are using a privacy-enhanced version.
