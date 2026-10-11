import React from 'react';
import { DashboardPage, AdminRecordPage, AuthPage, DataPage, FoodDetailPage, InteractiveMapPage, ListingFormPage, NotificationsPage, OnboardingPage, ProfileSettingsPage, QRVerificationPage, PickupPassPage, ScreenHeading } from '../../components/WorkspaceComponents.jsx';

import Icon from '../../components/Icon.jsx';
import Brand from '../../components/Brand.jsx';
import FoodCard from '../../components/FoodCard.jsx';
import PageHeading from '../../components/PageHeading.jsx';
import Step from '../../components/Step.jsx';
import Empty from '../../components/Empty.jsx';

export default function PickupverificationPage({ app }) {
  const { routeRecord, page, role, foods, claims, savedIds, approvedRequests, query, category, showFoodFilters, maxDistance, pickupCutoff, hideClaimed, sortNearby, toast, modal, selected, selectedAdminRecord, adminOutcomes, mobileNav, form, setForm, flash, navigate, filtered, clearFoodFilters, claimFood, toggleSaved, openFood, openAdminRecord, recordAction, addListing, setRole, setModal, setSelected, setMobileNav, setSelectedAdminRecord, setAdminOutcomes, setClaims, setFoods, setApprovedRequests, setQuery, setCategory, setShowFoodFilters, setMaxDistance, setPickupCutoff, setHideClaimed, setSortNearby, routeByPage, roles, location } = app;
  return (<QRVerificationPage onComplete={(value,kind)=>app.verifyPickup?.(value,kind)}/>);
}
