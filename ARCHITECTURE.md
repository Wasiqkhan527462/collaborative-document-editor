# Architecture Notes

- **Framework**: I chose **Next.js (App Router)** because it seamlessly integrates client-side interactivity (Tiptap) with server-side database actions (Server Actions).
- **Database**: I opted for **SQLite (`better-sqlite3`)** to provide instant, file-based local persistence that requires zero setup for the reviewer. 
  - *Deployment Note:* To allow a free deployment on Vercel, the app falls back to writing the database in the `/tmp` directory when in production (`NODE_ENV === 'production'`). Because Vercel serverless functions are ephemeral, data created on the live URL will periodically reset. When run locally, data persists permanently in the `./data` folder.
- **State & Auth**: To fulfill the sharing requirements while keeping scope reasonable, I built a `AuthContext` with mock seeded users. This allows you to rapidly switch "perspectives" and test sharing logic without real authentication overhead.
- **Styling**: As requested, I avoided Tailwind CSS and built a custom CSS Variable-based design system in `globals.css` that provides a premium, responsive glassmorphism aesthetic.
