# Running Locally

Run the app from the project folder:

```bash
cd "/Users/uzairaftab/Library/CloudStorage/OneDrive-Personal/Documents/Coding/Physical Therapy App v2"
npm run dev
```

Then open:

```text
http://127.0.0.1:5002
```

The frontend and backend run together in this app:

- Frontend: static files in `public/`, served by `server.js`
- Backend: JSON API routes under `/api/*`, also handled by `server.js`
- Local data: `data/app-data.json`, created automatically when data is saved

To run on a different port:

```bash
PORT=5010 npm run dev
```

Requirements:

- Node.js `>=20`
- No package dependencies are currently listed in `package.json`, so `npm install` is not required unless dependencies are added later.
