# Camping Sync marketing site

This is a standalone static site. It does not run inside the Camping Sync app
and it does not share the app's JavaScript or stylesheet bundle.

## View locally

From the repository root:

```bash
netlify dev
```

Open the localhost URL printed by the CLI (normally `http://localhost:8888`).
The root `netlify.toml` forces Netlify Dev to serve this folder as a static site.

## Deploy

Import this repository into Netlify. The checked-in `netlify.toml` sets the
publish directory to `marketing`, with no build command required.

All calls to action point to the live app at
`https://camping-sync.up.railway.app`. To change that later, update the
`data-app-url` value on the `<body>` in `index.html`.
