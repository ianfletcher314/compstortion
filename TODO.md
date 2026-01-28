# TODO

- [ ] Implement the rest of the plan
- [x] Make the highlight color match the pedal color
- [x] When reordering pedals, reorder the toggle buttons as well
- [ ] Create the ability to save presets

## Preset System - Approaches

### Approach 1: Local Storage Only (No users needed)
- Save presets to browser's `localStorage`
- Simple UI: Save/Load/Delete buttons + preset name input
- Pros: No backend, works offline, simple to implement
- Cons: Presets tied to browser/device, lost if cache cleared
- Could add JSON export/import for backup/sharing

### Approach 2: URL-based Presets (No users needed)
- Encode all settings in the URL hash (e.g., `#preset=eyJjb21wMS...`)
- Share presets by sharing links
- Combine with localStorage for saving favorites locally
- Pros: Easy sharing, no backend, bookmarkable
- Cons: Long URLs, still need local storage for persistence

### Approach 3: Backend with User Accounts
- Database to store presets (e.g., Supabase, Firebase, or custom)
- User authentication (OAuth with Google/GitHub or email)
- Pros: Access from any device, share with community, unlimited presets
- Cons: More complex, requires hosting/maintenance, auth flow
