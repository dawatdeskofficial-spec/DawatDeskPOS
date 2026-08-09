# TODO

- [ ] Fix auth flow so that deactivating/removing a user doesn’t force client logout and full redirect to /login on refresh.
- [ ] Update FrontEnd `AuthProvider` to NOT clear token/user and redirect when `/api/auth/me` fails (e.g., user inactive).
- [ ] Update `RoleGuard` so unauthorized role only blocks the specific page without redirecting to `/login` (or use a dedicated “unauthorized” behavior).
- [ ] Add backend change: when `isActive=false`, `/api/auth/me` should return 403/401 with a stable error shape; frontend should handle it without signOut/clearing token.
- [ ] Test: login as a staff user, remove/deactivate them from mainadmin, refresh a page → stay on that page (show proper empty/permission state) instead of being logged out.

