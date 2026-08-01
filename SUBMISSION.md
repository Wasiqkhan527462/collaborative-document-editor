# Submission Materials

This directory contains the full source code and documentation for the CollabDocs assessment. Below is a list of exactly what is included and how it satisfies the deliverables:

1. **Source Code**: The complete Next.js (App Router) codebase, including custom CSS for styling, Tiptap for the rich-text editor, and better-sqlite3 for persistence.
2. **README.md**: Includes local setup and run instructions, prerequisites, and testing commands.
3. **ARCHITECTURE.md**: A short architecture note explaining framework, database, state/auth, and styling choices.
4. **AI_WORKFLOW.md**: An AI workflow note detailing tools used, speed improvements, rejected AI outputs, and verification methods.
5. **SUBMISSION.md**: This file, listing exactly what is included in the submission folder.
6. **Live Product URL**: [TODO: Add Live URL Here]
7. **video_url.txt**: Contains the link to the 3-5 minute walkthrough video.
8. **Automated Tests**: Included in `src/lib/actions.test.ts` (run via `npm run test`).

## Application Features Implemented:
- **Document Creation & Editing**: Fully functioning rich-text editor using Tiptap.
- **File Upload**: Create a new document by uploading a `.txt` or `.md` file.
- **Sharing**: Mock authentication flow to test sharing permissions between distinct seeded users.
- **Persistence**: File-based SQLite (`better-sqlite3`) handling local storage seamlessly.
- **Premium UI**: Built with custom Vanilla CSS variables showcasing a modern glassmorphism aesthetic.
