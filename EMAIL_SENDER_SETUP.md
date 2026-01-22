# Email sender setup (Supabase Auth + Microsoft 365)

Goal: make Supabase confirmation emails (signup) come from `no-reply@onlyplaygolf.com`.

This project sends signup emails via **Supabase Auth** (see `src/pages/Auth.tsx` calling `supabase.auth.signUp`). The **From address is configured in Supabase**, not in the React app.

## 1) Microsoft 365 prerequisites (no-reply mailbox)

You need a mailbox that can authenticate via SMTP.

- Ensure `no-reply@onlyplaygolf.com` exists as a mailbox that can sign in.
- In Microsoft 365 Admin Center:
  - Enable **Authenticated SMTP** for `no-reply@onlyplaygolf.com` (often disabled by default).
  - If the tenant enforces MFA, create an **App Password** for this mailbox (Supabase SMTP uses username/password; it does not use OAuth).
  - If `no-reply@onlyplaygolf.com` is a shared mailbox / alias, make sure the authenticated user is allowed to **Send As** that address.

Microsoft 365 SMTP values (for Supabase):

- Host: `smtp.office365.com`
- Port: `587`
- Security: `STARTTLS` / TLS
- Username: `no-reply@onlyplaygolf.com`
- Password: mailbox password (or app password if MFA)

## 2) Supabase configuration (Auth → SMTP)

In your Supabase project dashboard:

- Go to **Authentication → Email / SMTP** (wording may vary).
- Turn on **Custom SMTP**.
- Paste the Microsoft 365 SMTP values above.
- Set:
  - **Sender name**: `OnlyPlay Golf` (or your preferred brand name)
  - **Sender email**: `no-reply@onlyplaygolf.com`
- Save.

Notes:
- This affects **confirmation emails** (and password reset emails) sent by Supabase Auth.
- No frontend changes are needed for the From address.

## 3) DNS / deliverability (highly recommended)

To avoid spam/junk folder or outright rejection, verify:

- **SPF**: domain TXT includes Microsoft 365 (commonly `include:spf.protection.outlook.com`) and ends with `~all` or `-all`.
- **DKIM**: enabled in Microsoft 365 and the two DKIM CNAMEs are published.
  - Common selectors are `selector1` and `selector2` under `._domainkey`.
- **DMARC**: optional but recommended (starts with `v=DMARC1;`).

You can run the helper script in this repo:

```bash
npm run check:email-dns
```

It prints SPF/DMARC/DKIM/MX records for `onlyplaygolf.com`.

## 4) End-to-end test

After SMTP is saved in Supabase:

0. Ensure Supabase Auth redirect allowlist is correct:
   - In Supabase dashboard, confirm **Authentication → URL Configuration** has:
     - **Site URL** set to your canonical public URL
     - **Redirect URLs / Additional Redirect URLs** include your confirmation redirect paths (e.g. `https://onlyplaygolf.com/*` and, if you use invites, `https://onlyplaygolf.com/auth*`)
1. Ensure `VITE_PUBLIC_APP_URL` is set in your frontend environment (Vercel) to the correct public URL for the environment (prod/staging). The app uses this value to generate `emailRedirectTo` for Supabase signup emails (fallback is `https://onlyplaygolf.com`). See `env.example`.
2. Create a fresh test user in the app.
3. Confirm the email arrives.
4. Check the message headers show:
   - From: `no-reply@onlyplaygolf.com`
   - Sent via your Microsoft 365 tenant (or its relay)
5. Click the confirmation link.
   - The app already sets `emailRedirectTo` in `src/pages/Auth.tsx` (invite flow supported).

## Troubleshooting

- If Supabase “test email” fails immediately:
  - SMTP AUTH may be disabled for the mailbox or at tenant level.
  - Credentials may be wrong (use app password if MFA).
  - STARTTLS/587 must be used (not implicit SSL on 465).
- If mail arrives but lands in spam:
  - SPF/DKIM/DMARC are incomplete or misconfigured.
  - Sender mailbox reputation is new; warm up and ensure consistent sending.
- If Microsoft 365 blocks SMTP AUTH (tenant policy):
  - Prefer a transactional provider (Resend/Postmark/SendGrid) for best reliability, still using `no-reply@onlyplaygolf.com` as the From (with proper domain verification).

