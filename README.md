# OnlyPlay Golf

OnlyPlay Golf is a golf training companion: track rounds, practice with structured drills, compete with friends, and analyze performance.

## Local development

### Prerequisites

- Node.js (recommended: latest LTS)
- npm

### Setup

```sh
npm i
npm run dev
```

Copy `env.example` to your local `.env` and adjust as needed.

### Useful scripts

```sh
npm run dev      # start Vite dev server
npm run build    # production build
npm run preview  # preview production build locally
npm run check:email-dns # verify SPF/DKIM/DMARC/MX for onlyplaygolf.com
```

### Email sender (Supabase Auth)

To make signup/confirmation emails come from `no-reply@onlyplaygolf.com`, follow the setup guide in `EMAIL_SENDER_SETUP.md`.

## Built with

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- Supabase

## Notes

- Supabase Edge Functions expect `AI_GATEWAY_URL` and `AI_GATEWAY_API_KEY` to be set in their runtime environment.
