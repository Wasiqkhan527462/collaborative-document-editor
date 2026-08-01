# CollabDocs

A lightweight, collaborative document editor built with Next.js, Postgres, and Tiptap.

## Features
- **Document Creation & Editing**: Rich text editor powered by Tiptap (Bold, Italic, Underline, Headings, Lists). Auto-saving implemented via debounced API calls.
- **File Upload**: Upload `.txt` or `.md` files to automatically create a new document with the file's contents.
- **Sharing Model**: Share documents with other users. Mock authentication is used to demonstrate switching between users and accessing shared files.
- **Persistence**: Postgres database to store users, documents, and shares securely and locally or remotely.
- **Premium UI**: Custom Vanilla CSS with CSS Variables implementing a modern, glassmorphism design system.

## Setup Instructions

### Prerequisites
- Node.js (v18+)
- npm

### Installation
1. Clone the repository or extract the project folder.
2. Navigate to the project root:
   ```bash
   cd assement
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Create a `.env.local` file in the root directory and add your Postgres connection string:
   ```env
   POSTGRES_URL=postgres://user:password@localhost:5432/dbname
   ```

### Running the App
Start the development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser. The Postgres database will automatically initialize and seed initial users on the first run.

### Running Tests
To run the automated tests using Vitest:
```bash
npm run test
```

## Architecture Notes
Please see the [ARCHITECTURE.md](./ARCHITECTURE.md) file for details on framework, database, state/auth, and styling choices.

## AI-Native Workflow Note
Please see the [AI_WORKFLOW.md](./AI_WORKFLOW.md) file for details on AI tool usage and workflow.
