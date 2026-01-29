# Supabase Presets Implementation Plan

## Overview
Add user authentication and cloud-saved presets to Compstortion using Supabase, while keeping the app deployable on GitHub Pages.

## Files to Modify/Create
- `js/main.js` - Add Supabase client, auth UI, preset save/load logic
- `css/pedal.css` - Styles for auth and preset UI components
- `index.html` - Add UI elements for auth and presets

## Implementation Steps

### Step 1: Supabase Project Setup (User action required)
- Create project at supabase.com
- Get project URL and anon key
- Create `presets` table with schema:
  ```sql
  create table presets (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade,
    name text not null,
    settings jsonb not null,
    created_at timestamptz default now()
  );

  -- Enable RLS
  alter table presets enable row level security;

  -- Users can only see/modify their own presets
  create policy "Users can manage own presets" on presets
    for all using (auth.uid() = user_id);
  ```

### Step 2: Add Supabase Client
- Add Supabase JS via CDN to index.html
- Create config with project URL and anon key
- Initialize Supabase client in main.js

### Step 3: Build Auth UI
- Add login/logout button to controls section
- Support Magic Link email authentication (no external setup required)
- Show user email when logged in
- Handle auth state changes

### Step 4: Build Preset UI
- Add preset controls below main controls:
  - Text input for preset name
  - "Save Preset" button
  - Dropdown to load saved presets
  - "Delete" button for current preset
- Only show when user is logged in

### Step 5: Implement Preset Logic
- **Save**: Serialize current state (all pedal settings + order) to JSON, save to Supabase
- **Load**: Fetch preset from Supabase, apply to state, update all knobs/UI
- **Delete**: Remove preset from Supabase
- **List**: Fetch user's presets on login

### Step 6: State Serialization
Create functions to:
- `getPresetData()` - Extract saveable state from current settings (includes pedal order)
- `applyPresetData(data)` - Apply loaded preset to state and update UI

## UI Mockup
```
[Start Audio] [Select Input ▼]

[email input] [Send Login Link]  <- when logged out

[user@email.com] [Logout]  <- when logged in
[Preset: ________] [Save] [Load ▼] [Delete]
```

## Verification
1. Create Supabase project and run SQL to create table
2. Test login/logout flow works
3. Save a preset, refresh page, verify it persists
4. Load preset, verify all knob positions and pedal states update
5. Delete preset, verify it's removed
6. Test with second account to verify RLS (can't see other users' presets)

## Notes
- All Supabase calls happen client-side (compatible with GitHub Pages)
- Presets stored as JSONB for flexibility
- RLS ensures users only access their own data
- Uses Magic Link (email OTP) auth - no Google OAuth setup required
