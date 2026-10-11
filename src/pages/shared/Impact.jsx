import React from 'react';
import { DashboardPage, AdminRecordPage, AuthPage, DataPage, FoodDetailPage, InteractiveMapPage, ListingFormPage, NotificationsPage, OnboardingPage, ProfileSettingsPage, QRVerificationPage, PickupPassPage, ScreenHeading } from '../../components/WorkspaceComponents.jsx';

import Icon from '../../components/Icon.jsx';
import Brand from '../../components/Brand.jsx';
import FoodCard from '../../components/FoodCard.jsx';
import PageHeading from '../../components/PageHeading.jsx';
import Step from '../../components/Step.jsx';
import Empty from '../../components/Empty.jsx';

export default function ImpactPage({ app }) {
  const { routeRecord, page, role, foods, claims, savedIds, approvedRequests, query, category, showFoodFilters, maxDistance, pickupCutoff, hideClaimed, sortNearby, toast, modal, selected, selectedAdminRecord, adminOutcomes, mobileNav, form, setForm, flash, navigate, filtered, clearFoodFilters, claimFood, toggleSaved, openFood, openAdminRecord, recordAction, addListing, setRole, setModal, setSelected, setMobileNav, setSelectedAdminRecord, setAdminOutcomes, setClaims, setFoods, setApprovedRequests, setQuery, setCategory, setShowFoodFilters, setMaxDistance, setPickupCutoff, setHideClaimed, setSortNearby, routeByPage, roles, location } = app;
  const quantities=new Map();
  claims.forEach(c=>{const amount=Number(c.quantity)||0;if(amount>0){const unit=String(c.unit||'units');quantities.set(unit,(quantities.get(unit)||0)+amount)}});
  const quantitySummary=quantities.size===0?'0':quantities.size===1?`${Number([...quantities.values()][0].toFixed(2)).toLocaleString()} ${[...quantities.keys()][0].toLowerCase()}`:`${quantities.size} unit types`;
  const completed=claims.filter(c=>c.status==='picked_up').length;
  const partners=(app.backendPublicOrganizations||[]).length;
  return (<><PageHeading kicker="SMALL ACTS, BIG IMPACT" title="Good adds up." text="Your FoodRescue activity, calculated from the records available to your account."/><div className="impact-hero"><div><span className="section-kicker">YOUR FOODRESCUE ACTIVITY</span><strong>Every shared meal<br/>makes a difference.</strong><p>Claim and pickup progress updates as the database changes.</p></div><span className="impact-illustration">✳</span></div><div className="impact-cards"><div><span>🍽</span><strong>{completed}</strong><small>pickups completed</small></div><div><span>♧</span><strong>{quantitySummary}</strong><small>quantity in your claims</small></div><div><span>♡</span><strong>{partners}</strong><small>organizations visible to your account</small></div></div><section className="section-head impact-bottom"><div><span className="section-kicker">HOW YOUR FOOD TRAVELS</span><h2>A little love, passed along.</h2></div></section><div className="steps impact-steps"><Step number="01" icon="♧" title="Shared by a local kitchen" text="Good food is listed while it’s fresh and ready to find a home."/><Step number="02" icon="⌂" title="Claimed by a neighbor" text="Nearby organizations find just what their community needs."/><Step number="03" icon="♡" title="Made into a moment" text="A rescued meal becomes nourishment, connection and hope."/></div></>);
}
