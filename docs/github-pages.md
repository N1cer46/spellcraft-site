# GitHub Pages

The site is fully static: recognition, animations, personal spells and learning progress run in the browser. No Express server or API keys are required on Pages.

The `Deploy to GitHub Pages` workflow installs from `package-lock.json`, checks types, runs tests, builds the client and publishes `dist/public`. Set repository **Settings → Pages → Source → GitHub Actions**. Pushes to `main` deploy automatically; a manual run is also available.

`actions/configure-pages` supplies the deployment base path. Both the router and local assets use that path, including recognition templates and symbol images. A `404.html` entry point and `.nojekyll` are generated during the Pages build.

Local verification for a project repository:

```sh
npm ci
npm run check
npm test
PAGES_BASE_PATH=/spellcraft npm run build:pages
```

Personal spells and progress are stored per browser and origin. Data on localhost is not automatically transferred to the published domain. Clearing website data removes those local collections.
