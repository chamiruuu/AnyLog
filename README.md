# AnyLog Team Filler

Manifest V3 Chrome extension plus a small Node/Express backend proxy for syncing login provider configuration from a private Google Sheet CSV.

The extension never stores or calls the Google Sheet CSV URL. It only calls your backend API URL, for example:

```text
https://my-domain.com/api/config
```

The backend privately reads `GOOGLE_SHEET_CSV_URL` from its environment, fetches the CSV server-side, normalizes the rows, removes disabled providers, and returns JSON to the extension.

## Project Structure

```text
extension/
  manifest.json
  popup.html
  popup.css
  popup.js
  options.html
  options.css
  options.js
  serviceWorker.js
  content.js
  storage.js
  configClient.js
  formFiller.js
  icons/
backend/
  package.json
  server.js
  .env.example
example-providers.csv
README.md
```

## Google Sheet Columns

Create a Google Sheet with these exact headers:

```text
Name,URL,Username,Password,MerchantID,UserSelector,PassSelector,MerchantSelector,SubmitSelector,Category,Notes,Enabled,AutoSubmit,Tags,Priority,LastUpdated
```

An example file is included at `example-providers.csv`.

Special version row:

```text
VERSION,,,,,,,,,,2026.07.23,true,false,,0,2026-07-23
```

Any row where `Name` is `VERSION` is treated as metadata and not returned as a provider. Disabled rows are removed by the backend.

## Backend Setup

1. Go to the backend folder:

```powershell
cd backend
```

2. Install dependencies:

```powershell
npm install
```

3. Copy the environment example:

```powershell
copy .env.example .env
```

4. Edit `.env`:

```text
PORT=3000
GOOGLE_SHEET_CSV_URL=https://docs.google.com/spreadsheets/d/e/.../pub?output=csv
API_TOKEN=choose-a-long-random-token
ALLOWED_EXTENSION_ID=
ALLOWED_ORIGINS=http://localhost:3000
CACHE_TTL_SECONDS=120
```

5. Start the backend:

```powershell
npm start
```

6. Test locally:

```text
http://localhost:3000/health
http://localhost:3000/api/config
```

If `API_TOKEN` is set, send:

```text
Authorization: Bearer your-token
```

## Deploy Backend To Vercel

This project is ready for Vercel from the repo root. You do not need to set a custom Root Directory.

### Option A: Vercel Dashboard

1. Push this project to GitHub.
2. Go to Vercel and click `Add New Project`.
3. Import your GitHub repo.
4. Keep the default root directory.
5. Add environment variables in Vercel:

Required environment variable:

```text
GOOGLE_SHEET_CSV_URL
```

Recommended environment variables:

```text
API_TOKEN
ALLOWED_EXTENSION_ID
CACHE_TTL_SECONDS=120
```

6. Deploy.

Your production API URL will look like:

```text
https://your-vercel-project.vercel.app/api/config
```

Put that URL in the Chrome extension Options page as the `Backend API URL`.

### Option B: Vercel CLI

From the repo root:

```powershell
npx vercel
```

When Vercel asks for environment variables, add:

```text
GOOGLE_SHEET_CSV_URL
API_TOKEN
ALLOWED_EXTENSION_ID
CACHE_TTL_SECONDS
```

For production deploy:

```powershell
npx vercel --prod
```

After publishing or loading the extension, set `ALLOWED_EXTENSION_ID` to your Chrome extension ID. During local development, you can leave it blank.

## Add To GitHub Repo

This folder is a Git repo. To push it to GitHub:

1. Create a new empty GitHub repo.
2. Copy the repo URL.
3. Run these commands from this folder:

```powershell
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
git branch -M main
git push -u origin main
```

The `.gitignore` file excludes `backend/.env`, `node_modules`, Vercel local files, logs, and build output.

## Chrome Extension Setup

1. Open Chrome.
2. Go to:

```text
chrome://extensions
```

3. Enable `Developer mode`.
4. Click `Load unpacked`.
5. Select the `extension/` folder.
6. Open the extension options page.
7. Set `Backend API URL` to your deployed endpoint, for example:

```text
https://my-domain.com/api/config
```

8. If your backend uses `API_TOKEN`, paste the same token in the options page.
9. Click `Save Settings`.
10. Click `Sync Now`.

## Daily Use

Open the popup, search for a provider, then click the provider row or press `Enter`.

Available actions:

- Provider row click: saves a pending login instruction for about 30 seconds, opens the provider URL in a new tab, fills when the hostname matches, and submits if that provider has `AutoSubmit=true`.
- Fill current page icon: safer manual mode for an already-open provider page.
- Favorite icon: keeps important providers at the top. Favorites are saved in `chrome.storage.local`, so each Chrome user/profile has their own favorites.
- Details icon: opens the provider detail view with URL, category, tags, last sync, notes, and admin selector testing.
- `Test Selectors`: visible for admin role, checks whether selectors exist on the current tab.

Keyboard support:

- Type to search.
- Use arrow keys to move through results.
- Press `Enter` to open and fill the selected provider.

## Security Notes

The Google Sheet CSV URL is not exposed to the extension. That is the main protection this architecture provides.

However, credentials returned to a Chrome extension are still sensitive. Extension code, local storage, browser profiles, and synced backups are not a vault. This project includes a backup option that omits secrets by default, but provider credentials still exist locally after sync so the filler can work offline.

Long-term recommendation:

- Move credentials out of Google Sheets.
- Store secrets in a backend vault or password manager API.
- Return only short-lived fill tokens to the extension.
- Restrict backend CORS to your extension ID.
- Require `API_TOKEN` or stronger user authentication.
- Limit access to the source Google Sheet.
- Rotate credentials regularly.

## Selector Tips

Prefer stable selectors:

```text
input[name="email"]
input[name="password"]
button[type="submit"]
```

Avoid selectors generated by build tools:

```text
.css-1abcxyz
div:nth-child(4) > input
```

For React, Vue, and Angular forms, the content script uses the native input value setter and dispatches `keydown`, `input`, `change`, `keyup`, and `blur` events so frameworks can detect the changes.

## Backend Response Shape

The backend returns sanitized JSON like:

```json
{
  "ok": true,
  "source": "sheet-proxy",
  "version": "2026.07.23",
  "generatedAt": "2026-07-23T00:00:00.000Z",
  "providers": [
    {
      "id": "stable-id",
      "name": "Acme Portal",
      "url": "https://portal.example.com/login",
      "category": "Payments",
      "enabled": true,
      "autoSubmit": false,
      "tags": ["payment", "daily"],
      "priority": 90,
      "credentials": {
        "username": "team.user@example.com",
        "password": "replace-me",
        "merchantId": "MER-1001"
      },
      "selectors": {
        "username": "input[name=\"email\"]",
        "password": "input[name=\"password\"]",
        "merchant": "input[name=\"merchant\"]",
        "submit": "button[type=\"submit\"]"
      }
    }
  ]
}
```

The raw Google Sheet URL is never returned.
