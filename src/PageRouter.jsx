import React from 'react';

// Authentication / onboarding
import SignInPage from './pages/auth/SignIn.jsx';
import CreateAccountPage from './pages/auth/CreateAccount.jsx';
import OnboardingPage from './pages/auth/Onboarding.jsx';
import AdminSignInPage from './pages/auth/AdminSignIn.jsx';

// Recipient
import RecipientDashboard from './pages/recipient/RecipientDashboard.jsx';
import BrowseFoodPage from './pages/recipient/BrowseFood.jsx';
import SavedFoodPage from './pages/recipient/SavedFood.jsx';
import MyClaimsPage from './pages/recipient/MyClaims.jsx';
import MyPickupsPage from './pages/recipient/MyPickups.jsx';
import MapViewPage from './pages/recipient/MapView.jsx';
import FoodDetailsPage from './pages/recipient/FoodDetails.jsx';
import PickupPassPage from './pages/recipient/PickupPass.jsx';

// Donor
import DonorDashboard from './pages/donor/DonorDashboard.jsx';
import PostFoodPage from './pages/donor/PostFood.jsx';
import MyListingsPage from './pages/donor/MyListings.jsx';
import PickupRequestsPage from './pages/donor/PickupRequests.jsx';
import DonorImpactPage from './pages/donor/DonorImpact.jsx';
import DonationDetailsPage from './pages/donor/DonationDetails.jsx';

// Volunteer
import VolunteerDashboard from './pages/volunteer/VolunteerDashboard.jsx';
import AvailablePickupsPage from './pages/volunteer/AvailablePickups.jsx';
import VolunteerPickupsPage from './pages/volunteer/VolunteerPickups.jsx';
import VolunteerSchedulePage from './pages/volunteer/VolunteerSchedule.jsx';
import PickupDetailsPage from './pages/volunteer/PickupDetails.jsx';
import PickupVerificationPage from './pages/volunteer/PickupVerification.jsx';

// Admin
import AdminDashboard from './pages/admin/AdminDashboard.jsx';
import OrganizationVerificationPage from './pages/admin/OrganizationVerification.jsx';
import ModerateListingsPage from './pages/admin/ModerateListings.jsx';
import ManageReportsPage from './pages/admin/ManageReports.jsx';
import UserManagementPage from './pages/admin/UserManagement.jsx';
import AuditLogPage from './pages/admin/AuditLog.jsx';
import AdminRecord from './pages/admin/AdminRecord.jsx';

// Shared
import OverviewPage from './pages/shared/Overview.jsx';
import ImpactPage from './pages/shared/Impact.jsx';
import NotificationsPage from './pages/shared/Notifications.jsx';
import ProfilePage from './pages/shared/Profile.jsx';
import ReportIssuePage from './pages/shared/ReportIssue.jsx';
import SettingsPage from './pages/shared/Settings.jsx';
import NotFoundPage from './pages/shared/NotFound.jsx';

export function PageRouter({ page, app }) {
  switch (page) {
    case 'Sign in': return <SignInPage app={app}/>;
    case 'Create account': return <CreateAccountPage app={app}/>;
    case 'Onboarding': return <OnboardingPage app={app}/>;
    case 'Admin sign in': return <AdminSignInPage app={app}/>;

    case 'Recipient dashboard': return <RecipientDashboard app={app}/>;
    case 'Browse food': return <BrowseFoodPage app={app}/>;
    case 'Saved food': return <SavedFoodPage app={app}/>;
    case 'My claims': return <MyClaimsPage app={app}/>;
    case 'My pickups': return <MyPickupsPage app={app}/>;
    case 'Map view': return <MapViewPage app={app}/>;
    case 'Food details': return <FoodDetailsPage app={app}/>;
    case 'Pickup pass': return <PickupPassPage app={app}/>;

    case 'Donor dashboard': return <DonorDashboard app={app}/>;
    case 'Post food': return <PostFoodPage app={app}/>;
    case 'My listings': return <MyListingsPage app={app}/>;
    case 'Pickup requests': return <PickupRequestsPage app={app}/>;
    case 'Donor impact': return <DonorImpactPage app={app}/>;
    case 'Donation details': return <DonationDetailsPage app={app}/>;

    case 'Volunteer dashboard': return <VolunteerDashboard app={app}/>;
    case 'Available pickups': return <AvailablePickupsPage app={app}/>;
    case 'Volunteer pickups': return <VolunteerPickupsPage app={app}/>;
    case 'Volunteer schedule': return <VolunteerSchedulePage app={app}/>;
    case 'Pickup details': return <PickupDetailsPage app={app}/>;
    case 'Pickup verification': return <PickupVerificationPage app={app}/>;

    case 'Admin dashboard': return <AdminDashboard app={app}/>;
    case 'Organization verification': return <OrganizationVerificationPage app={app}/>;
    case 'Moderate listings': return <ModerateListingsPage app={app}/>;
    case 'Manage reports': return <ManageReportsPage app={app}/>;
    case 'User management': return <UserManagementPage app={app}/>;
    case 'Audit log': return <AuditLogPage app={app}/>;
    case 'Organization review': return <AdminRecord app={app}/>;
    case 'Listing review': return <AdminRecord app={app}/>;
    case 'Report review': return <AdminRecord app={app}/>;
    case 'User detail': return <AdminRecord app={app}/>;
    case 'Audit detail': return <AdminRecord app={app}/>;

    case 'Overview': return <OverviewPage app={app}/>;
    case 'Impact': return <ImpactPage app={app}/>;
    case 'Notifications': return <NotificationsPage app={app}/>;
    case 'Profile': return <ProfilePage app={app}/>;
    case 'Report issue': return <ReportIssuePage app={app}/>;
    case 'Settings': return <SettingsPage app={app}/>;
    default: return <NotFoundPage app={app}/>;
  }
}
