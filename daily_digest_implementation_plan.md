# ⚖️ Daily Digest Email — Step-by-Step Setup Guide

All the code is written. Follow these steps in order to deploy and activate the feature.

---

## Step 1: Run the SQL Migration

Open your **Supabase Dashboard** → **SQL Editor** and run the contents of:
📄 `daily_digest_setup.sql` (in your project root)

> **Before running**: Replace `<YOUR_SERVICE_ROLE_KEY>` in the SQL file with your actual
> **Service Role Key** from: Supabase Dashboard → Project Settings → API → `service_role` (the `secret` one).

This does 3 things:
- ✅ Adds `digest_enabled` column to `profiles` table
- ✅ Enables `pg_cron` and `pg_net` extensions
- ✅ Schedules a daily 8:00 AM IST cron job

After running, verify with:
```sql
SELECT * FROM cron.job;
```

---

## Step 2: Install Supabase CLI

Open a terminal and run:
```bash
npm install -g supabase
```

---

## Step 3: Login to Supabase CLI

```bash
supabase login
```
This opens your browser to authenticate. Follow the prompts.

---

## Step 4: Link Your Project

Navigate to your project folder and run:
```bash
cd LexTrack
supabase link --project-ref wfspwemzbprucailzuvr
```
Enter your **database password** when prompted.

---

## Step 5: Set the Resend API Key as a Secret

```bash
supabase secrets set RESEND_API_KEY=re_16okuhza_6yE2HnTY9xYrdKbV5Jj2uPEE
```
This stores the key securely — it's never hardcoded in your code.

---

## Step 6: Deploy the Edge Function

```bash
supabase functions deploy send-daily-digest --no-verify-jwt
```

You should see output confirming the function was deployed.

---

## Step 7: Test It Manually

Test the function with curl (replace `<SERVICE_ROLE_KEY>` with your actual key):
```bash
curl -X POST https://wfspwemzbprucailzuvr.supabase.co/functions/v1/send-daily-digest \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -d '{"source": "manual-test"}'
```

Or from the **Supabase Dashboard** → **Edge Functions** → `send-daily-digest` → click **Invoke**.

---

## Step 8: Enable the Toggle in Your App

1. Open LexTrack
2. Go to **Settings**
3. Turn ON **"Daily Digest Email"**
4. This saves `digest_enabled = true` in your profile

---

## What Happens Now

| Time | Action |
|------|--------|
| Every day at **8:00 AM IST** | pg_cron triggers the Edge Function |
| Edge Function | Queries all users with `digest_enabled = true` |
| For each user | Fetches their active cases with hearings in the next 7 days |
| If hearings exist | Sends a beautiful HTML digest email via Resend |
| If no hearings | Skips silently (no unnecessary emails) |

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Email not received" | Check spam folder — `onboarding@resend.dev` sender may be flagged |
| "No subscribers" response | Make sure you toggled ON "Daily Digest Email" in Settings |
| "Missing environment variables" | Re-run `supabase secrets set RESEND_API_KEY=...` |
| Cron not running | Verify in SQL Editor: `SELECT * FROM cron.job;` |
| Function deployment fails | Make sure you ran `supabase link` first |

---

## Optional: Use Your Own Domain (Production)

To send from `alerts@yourdomain.com` instead of `onboarding@resend.dev`:
1. Go to [Resend Dashboard](https://resend.com/domains) → Add Domain
2. Add the DNS records they provide (MX, SPF, DKIM)
3. Once verified, update the `from` field in `index.ts` to your domain email
4. Re-deploy: `supabase functions deploy send-daily-digest --no-verify-jwt`
