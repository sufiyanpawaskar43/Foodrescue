# FoodRescue Frontend Structure

The existing UI/UX and functionality are preserved. Pages are separated by user role so each role has its own page folder.

```text
src/
├── App.jsx
├── PageRouter.jsx
├── appData.js
├── main.jsx
├── styles.css
│
├── components/
│   ├── AppShell.jsx
│   ├── Brand.jsx
│   ├── Empty.jsx
│   ├── FoodCard.jsx
│   ├── Icon.jsx
│   ├── PageHeading.jsx
│   ├── Step.jsx
│   └── WorkspaceComponents.jsx
│
└── pages/
    ├── auth/
    │   ├── SignIn.jsx
    │   ├── CreateAccount.jsx
    │   └── Onboarding.jsx
    │
    ├── recipient/
    │   ├── RecipientDashboard.jsx
    │   ├── BrowseFood.jsx
    │   ├── SavedFood.jsx
    │   ├── MapView.jsx
    │   ├── MyClaims.jsx
    │   ├── MyPickups.jsx
    │   ├── PickupPass.jsx
    │   └── FoodDetails.jsx
    │
    ├── donor/
    │   ├── DonorDashboard.jsx
    │   ├── PostFood.jsx
    │   ├── MyListings.jsx
    │   ├── PickupRequests.jsx
    │   ├── DonorImpact.jsx
    │   └── DonationDetails.jsx
    │
    ├── volunteer/
    │   ├── VolunteerDashboard.jsx
    │   ├── AvailablePickups.jsx
    │   ├── VolunteerPickups.jsx
    │   ├── VolunteerSchedule.jsx
    │   ├── PickupDetails.jsx
    │   └── PickupVerification.jsx
    │
    ├── admin/
    │   ├── AdminDashboard.jsx
    │   ├── OrganizationVerification.jsx
    │   ├── ModerateListings.jsx
    │   ├── ManageReports.jsx
    │   ├── UserManagement.jsx
    │   ├── AuditLog.jsx
    │   └── AdminRecord.jsx
    │
    └── shared/
        ├── Overview.jsx
        ├── Impact.jsx
        ├── Notifications.jsx
        ├── Profile.jsx
        ├── ReportIssue.jsx
        ├── Settings.jsx
        └── NotFound.jsx
```

## Backend contract

- `supabase/migrations/20261008190000_foodrescue_core.sql` — schema, RLS, triggers and RPC endpoints.
- `supabase/README.md` — setup instructions for the user's own Supabase project.
- `docs/API_ENDPOINTS.md` — page/action/role endpoint map.
- `src/services/backend.js` — active REST/RPC client used by authenticated page actions.
- `src/services/auth.js` — Supabase Auth REST client with persisted/refreshable sessions.
