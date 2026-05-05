# VisibilityIQ

**AEO/GEO monitoring platform** — Know exactly when and where AI recommends your brand.

Monitor your brand's presence across ChatGPT, Claude, Gemini, Perplexity and more. Track citations, benchmark competitors, audit content gaps, and generate AI-optimized content briefs.

---

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Database**: PostgreSQL + Prisma ORM
- **Auth**: NextAuth.js v5 (credentials + Google OAuth)
- **Email**: Resend
- **Deployment**: Vercel

---

## Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/your-org/visibilityiq.git
cd visibilityiq
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

```bash
cp .env.example .env
```

Fill in all values in `.env`:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Random secret — run `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Your app URL (e.g. `http://localhost:3000`) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `RESEND_API_KEY` | Resend API key for transactional email |
| `RESEND_FROM_EMAIL` | Verified sender email address |

### 4. Set up the database

```bash
npx prisma migrate dev --name init
npx prisma generate
```

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Project Structure

```
visibilityiq/
├── app/
│   ├── page.tsx                  # Landing page
│   ├── layout.tsx                # Root layout
│   ├── globals.css               # Global styles (Tailwind + CSS vars)
│   ├── auth/
│   │   ├── login/page.tsx        # Sign-in page
│   │   ├── signup/page.tsx       # Registration page
│   │   └── error/page.tsx        # Auth error page
│   ├── dashboard/
│   │   ├── layout.tsx            # Dashboard layout (auth guard + sidebar)
│   │   ├── page.tsx              # Overview / home
│   │   ├── ai-visibility/        # AI visibility scores by model
│   │   ├── citations/            # Citation log
│   │   ├── competitors/          # Competitor benchmarking
│   │   ├── content-briefs/       # AI-generated content briefs
│   │   ├── audit/                # AI readiness audit tool
│   │   ├── copilot/              # AI Copilot chat interface
│   │   └── settings/             # Account & billing settings
│   └── api/
│       ├── auth/[...nextauth]/   # NextAuth route handler
│       └── auth/register/        # User registration endpoint
├── components/
│   ├── dashboard/
│   │   ├── sidebar.tsx           # Sidebar navigation
│   │   └── topbar.tsx            # Top navigation bar
│   ├── session-provider.tsx      # NextAuth session wrapper
│   └── ui/                       # shadcn/ui components
├── lib/
│   ├── auth.ts                   # NextAuth config
│   ├── prisma.ts                 # Prisma client singleton
│   └── utils.ts                  # Utility functions
└── prisma/
    └── schema.prisma             # Database schema
```

---

## Database Schema

The Prisma schema includes:

- **User** — accounts with email/password or OAuth
- **Account** — OAuth provider links (NextAuth)
- **Session** — active user sessions (NextAuth)
- **VerificationToken** — email verification (NextAuth)
- **Project** — monitored brand/domain
- **Citation** — AI model citation records
- **Competitor** — tracked competitor domains
- **Audit** — AI readiness audit results

---

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API
4. Create OAuth 2.0 credentials (Web application)
5. Add authorized redirect URI: `{YOUR_URL}/api/auth/callback/google`
6. Copy the Client ID and Secret to `.env`

---

## Deployment (Vercel)

1. Push your code to GitHub
2. Import the repo in [Vercel](https://vercel.com/)
3. Add all environment variables from `.env.example` in the Vercel dashboard
4. Set `NEXTAUTH_URL` to your production domain
5. Use a managed PostgreSQL provider (Supabase, Neon, or Vercel Postgres)
6. Run migrations:

```bash
npx prisma migrate deploy
```

---

## Development Commands

```bash
npm run dev              # Start dev server
npm run build            # Production build
npm run start            # Start production server
npm run lint             # ESLint
npx prisma studio        # Open Prisma Studio (DB GUI)
npx prisma migrate dev   # Create and apply migration
npx prisma generate      # Regenerate Prisma client
```

---

## License

MIT
