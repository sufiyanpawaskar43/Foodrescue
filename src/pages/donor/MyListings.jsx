import React from 'react';
import { DataPage } from '../../components/WorkspaceComponents.jsx';

export default function MyListingsPage({ app }) {
  const rows = (app.backendMyFood || []).map(food => [food.title, food.qty, food.category, food.time, food.status || 'available', food.id]);
  return <DataPage eyebrow="DONOR WORKSPACE" title="Your surplus, shared well." description="Keep track of the food you’ve made available to your community." columns={['Listing','Quantity','Category','Pickup by','Status']} rows={rows} onAction={row => {
    const food = (app.backendMyFood || []).find(item => String(item.id) === String(row[5]));
    if (food) app.openDonationDetails(food);
  }} actionLabel="Manage" emptyLabel="You have no listings yet" />;
}
