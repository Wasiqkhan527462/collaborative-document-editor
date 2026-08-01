# AI-Native Workflow Note

**Which AI tools you used**
I utilized Cursor (powered by Claude 3.5 Sonnet) as my primary IDE for inline generation and autocomplete, alongside ChatGPT for architectural sounding-boarding (e.g., verifying the best lightweight SQLite setup for Next.js App Router).

**Where AI materially sped up your work**
AI significantly accelerated boilerplate generation. It was particularly helpful in scaffolding the initial SQLite database schema, generating the Tiptap editor floating toolbar components, and outputting the initial CSS variable boilerplate for the glassmorphism design system. It also rapidly stubbed out the Vitest test cases.

**What AI-generated output you changed or rejected**
- **Rejected:** The AI initially failed to account for `next/cache`'s `revalidatePath` during testing, which caused the Vitest suite to fail (since Next.js runtime methods aren't available in Node.js). I had to manually mock `vi.mock('next/cache')` to fix this.
- **Changed:** When generating the Tiptap auto-save logic, the AI placed the `title` state directly in the `onUpdate` closure, creating a stale closure bug. I completely refactored this to use a `useRef` (and synced it synchronously before editor hydration) to fix a race condition where the document title would overwrite to an empty string on load.

**How you verified correctness, UX quality, and implementation reliability**
- **Correctness & Reliability:** I utilized Vitest to ensure the core database queries and server actions worked flawlessly in isolation. For integration reliability, I manually tested critical flows including hydration race conditions, file parsing, and permission boundary checks (Editor vs Viewer).
- **UX Quality:** I continuously ran the local dev server to manually audit the UI. I verified that micro-interactions (like hover states on document cards and toolbar transitions) felt premium and responsive, ensuring the UX met high aesthetic standards and felt cohesive without relying on off-the-shelf Tailwind components.
