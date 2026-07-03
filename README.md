# Physical Therapy Tracker

Physical Therapy Tracker is a personal app I created to log my own physical therapy exercises, track completed workouts, and review progress over time.

I used Claude Design to build the layout, icons, and visuals that shaped the app's interface.

## Production

The production app is available at:

[https://physical-therapy-tracker.vercel.app/](https://physical-therapy-tracker.vercel.app/)

If you do not want to create an account or log in, use the **Try the demo experience** option on the sign-in page to access the demo flow.

## Architecture

The app is a same-origin web application:

- The frontend is a static browser SPA served from `public/`.
- `server.js` runs the Node HTTP server, serves static assets, and handles the JSON API under `/api/*`.
- Shared domain helpers live in `lib/`.
- Persistent account-backed data is stored in Neon PostgreSQL, with a local JSON fallback for environments without `DATABASE_URL`.

## Hosting

Physical Therapy Tracker is hosted on Vercel and backed by Neon PostgreSQL. The production deployment uses the Vercel domain linked above.
