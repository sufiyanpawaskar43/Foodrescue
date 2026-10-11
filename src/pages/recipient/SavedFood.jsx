import React from 'react';
import { DashboardPage, AdminRecordPage, AuthPage, DataPage, FoodDetailPage, InteractiveMapPage, ListingFormPage, NotificationsPage, OnboardingPage, ProfileSettingsPage, QRVerificationPage, PickupPassPage, ScreenHeading } from '../../components/WorkspaceComponents.jsx';

import Icon from '../../components/Icon.jsx';
import Brand from '../../components/Brand.jsx';
import FoodCard from '../../components/FoodCard.jsx';
import PageHeading from '../../components/PageHeading.jsx';
import Step from '../../components/Step.jsx';
import Empty from '../../components/Empty.jsx';

export default function SavedfoodPage({ app }) {
  const { routeRecord, page, role, foods, claims, savedIds, approvedRequests, query, category, showFoodFilters, maxDistance, pickupCutoff, hideClaimed, sortNearby, toast, modal, selected, selectedAdminRecord, adminOutcomes, mobileNav, form, setForm, flash, navigate, filtered, clearFoodFilters, claimFood, toggleSaved, openFood, openAdminRecord, recordAction, addListing, setRole, setModal, setSelected, setMobileNav, setSelectedAdminRecord, setAdminOutcomes, setClaims, setFoods, setApprovedRequests, setQuery, setCategory, setShowFoodFilters, setMaxDistance, setPickupCutoff, setHideClaimed, setSortNearby, routeByPage, roles, location } = app;
  return (<><PageHeading kicker="YOUR SAVED FINDS" title="Saved food" text="Keep nearby listings handy and come back when you’re ready."/><div className="food-grid browse-grid">{foods.filter(f=>savedIds.includes(f.id)).length?foods.filter(f=>savedIds.includes(f.id)).map(f=><FoodCard key={f.id} food={f} saved onSave={()=>toggleSaved(f)} claimed={claims.some(c=>c.id===f.id)} onOpen={()=>openFood(f)} onClaim={()=>claimFood(f)}/>):<Empty title="Save something for later." text="Tap the heart on a food listing and it will be waiting here." action={()=>navigate('Browse food')}/>}</div></>);
}
