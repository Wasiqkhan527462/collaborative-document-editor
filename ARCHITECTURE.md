# Architecture Notes

- **Framework**: I chose **Next.js (App Router)** because it seamlessly integrates client-side interactivity (Tiptap) with server-side database actions (Server Actions).
- **Database**: I opted for **PostgreSQL (`pg`)** to provide robust, persistent storage across serverless function executions.
  - *Deployment Note:* To allow a free deployment on Vercel while maintaining data persistence, the app connects to an external Postgres database via `POSTGRES_URL` or `DATABASE_URL`. This solves the issue with ephemeral storage that would occur if using local file-based databases like SQLite on a serverless platform.
- **State & Auth**: To fulfill the sharing requirements while keeping scope reasonable, I built a `AuthContext` with mock seeded users. This allows you to rapidly switch "perspectives" and test sharing logic without real authentication overhead.
- **Styling**: As requested, I avoided Tailwind CSS and built a custom CSS Variable-based design system in `globals.css` that provides a premium, responsive glassmorphism aesthetic.
