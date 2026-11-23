# PetWatch profile and account settings setup

## 1. Apply the Supabase SQL

Open Supabase Dashboard → SQL Editor and run `PETWATCH-AUTH-PROFILE-SETUP.sql`.

This creates a `profiles` table with row-level security so each signed-in user can access only their own profile, and creates the `profile-avatars` Storage bucket with per-user upload/update/delete policies.

## 2. Configure password reset redirects

In Supabase Dashboard → Authentication → URL Configuration:
- Set the Site URL to your deployed PetWatch URL.
- Add `http://localhost:5173` to Redirect URLs for local development.
- Add your deployed URL as a Redirect URL too.

The forgot-password email returns the user to the app. When the recovery session is detected, the profile/account dialog opens so they can enter and save a new password.

## 3. Included changes

- Edit account name and pet name from the profile control in the sidebar.
- Optional profile photo upload (image only, max 3 MB).
- Profile name and pet name appear in the dashboard greeting and pet panel.
- Show/hide password controls on sign-up and login; also available for password changes.
- Forgot password email flow and authenticated change-password form.
- Kitchen feeder status uses the latest device heartbeat or sensor reading: fresh activity = Online, old activity = Offline, and no activity = Unknown.

## Notes

- Do not put the Supabase service-role key in the browser.
- The `profile-avatars` bucket is public so avatar images can display without a signed URL. Upload, update, and delete are still restricted to the authenticated user's own folder. Do not store private documents in this bucket.
- Database RLS for sensor, alert, schedule, history, and device-command tables is not changed by this migration. Device access should be secured separately so ESP32 telemetry and commands are not accidentally blocked.
