import React from 'react';
import { FoodDetailPage, ScreenHeading } from '../../components/WorkspaceComponents.jsx';
export default function FoodDetailsPage({ app }) {
  const { foods, selected, claims, location, claimFood, navigate } = app;
  const food = foods.find(f=>String(f.id)===location.pathname.split('/').pop()) || (selected && String(selected.id)===location.pathname.split('/').pop() ? selected : null);
  if (!food) return <><ScreenHeading eyebrow="FOODRESCUE" title="Food details unavailable" description="This listing is no longer available or could not be loaded from Supabase."/><button className="btn btn-outline" onClick={()=>navigate('Browse food')}>← Browse food</button></>;
  const claimed=claims.some(c=>c.id===food.id || c.listing_id===food.id);
  return <FoodDetailPage food={food} claimed={claimed} onClaim={()=>claimFood(food)}/>;
}
