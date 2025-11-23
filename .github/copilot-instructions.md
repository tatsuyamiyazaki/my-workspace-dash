# Project Context & Architecture
- **Framework:** Next.js (App Router), TypeScript, Tailwind CSS.
- **Core Libraries:** `firebase` (Auth/Firestore), `lucide-react` (Icons), `date-fns` (Date manipulation).
- **Purpose:** Personal dashboard integrating Gmail, Google Calendar, and Google Tasks.

# Architectural Patterns
- **Directory Structure:**
  - `app/`: Pages and layouts. Use `app/dashboard/` for authenticated views.
  - `lib/`: Shared logic. `lib/firebase.ts` for init, `lib/gmailApi.ts` for API calls.
  - `contexts/`: Global state, specifically `AuthContext.tsx`.
- **Authentication (Critical):**
  - Use Firebase Authentication with `GoogleAuthProvider`.
  - **Scopes:** Must explicitly add scopes in `lib/firebase.ts`:
    - `https://www.googleapis.com/auth/gmail.modify`
    - `https://www.googleapis.com/auth/calendar`
    - `https://www.googleapis.com/auth/tasks`
  - **Token Handling:** Retrieve the Google Access Token via `GoogleAuthProvider.credentialFromResult(result)` during login.
  - **Security:** Store the Access Token in **memory only** (React Context/State). Do NOT persist sensitive Google API tokens to Firestore or LocalStorage.

# Coding Conventions
- **Components:** Functional components with TypeScript interfaces for props.
- **Styling:** Tailwind CSS utility classes.
- **Dates:** Always use `date-fns` for formatting and manipulation.
- **Icons:** Import from `lucide-react` (e.g., `import { Mail } from 'lucide-react'`).

# Critical Workflows
- **Setup:** Refer to `docs/setup.md` for environment variable requirements (`.env.local`).
- **Development:** Run `npm run dev`.
