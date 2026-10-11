import React from 'react';
import { DashboardPage, AdminRecordPage, AuthPage, DataPage, FoodDetailPage, InteractiveMapPage, ListingFormPage, NotificationsPage, OnboardingPage, ProfileSettingsPage, QRVerificationPage, PickupPassPage, ScreenHeading } from '../../components/WorkspaceComponents.jsx';

import Icon from '../../components/Icon.jsx';
import Brand from '../../components/Brand.jsx';
import FoodCard from '../../components/FoodCard.jsx';
import PageHeading from '../../components/PageHeading.jsx';
import Step from '../../components/Step.jsx';
import Empty from '../../components/Empty.jsx';

export default function MyclaimsPage({ app }) {
  const { routeRecord, page, role, foods, claims, savedIds, approvedRequests, query, category, showFoodFilters, maxDistance, pickupCutoff, hideClaimed, sortNearby, toast, modal, selected, selectedAdminRecord, adminOutcomes, mobileNav, form, setForm, flash, navigate, filtered, clearFoodFilters, claimFood, toggleSaved, openFood, openAdminRecord, recordAction, addListing, setRole, setModal, setSelected, setMobileNav, setSelectedAdminRecord, setAdminOutcomes, setClaims, setFoods, setApprovedRequests, setQuery, setCategory, setShowFoodFilters, setMaxDistance, setPickupCutoff, setHideClaimed, setSortNearby, routeByPage, roles, location } = app;
  return (<><PageHeading kicker="YOUR COMMUNITY PICKUPS" title="My claims" text="Everything you’ve set aside, all in one place." action={<span className="small-muted">{claims.length} {claims.length===1?'active claim':'active claims'}</span>}/>{claims.length?<div className="list-stack">{claims.map(f=><div className="claim-row" key={f.id}><img src={f.image} alt=""/><div className="claim-main"><span className={`status-pill ${f.pickupStatus==='Picked up'?'status-muted':'status-green'}`}><i/>{f.pickupStatus||'Confirmed'}</span><h3>{f.title}</h3><p>{f.donor} · {f.qty}</p></div><div className="claim-meta"><strong>{f.time}</strong><span>{f.area}</span></div><button className="btn btn-outline" onClick={()=>app.openPickupPass(f)} disabled={f.pickupStatus!=='Approved'}>{f.pickupStatus==='Picked up'?'Picked up':f.pickupStatus==='Approved'?'Pickup pass':'Awaiting approval'} <span>→</span></button></div>)}</div>:<Empty title="A little good starts here." text="When you find something your community needs, your claims will show up here." action={()=>navigate('Browse food')}/>}</>);
}
