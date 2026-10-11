

export const photo = (id, w=900) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=85`;
export const routeByPage = {
  'Overview':'/', 'Browse food':'/browse', 'Saved food':'/recipient/saved', 'Map view':'/map', 'My claims':'/recipient/claims', 'My pickups':'/recipient/pickups', 'Pickup pass':'/pickup/pass', 'Impact':'/impact',
  'My listings':'/donor/listings', 'Donor dashboard':'/donor/dashboard', 'Post food':'/donor/new-listing', 'Pickup requests':'/donor/requests', 'Donor impact':'/donor/impact',
  'Recipient dashboard':'/recipient/dashboard', 'Pickup verification':'/pickup/verify', 'Notifications':'/notifications', 'Profile':'/profile', 'Report issue':'/report',
  'Volunteer dashboard':'/volunteer/dashboard', 'Available pickups':'/volunteer/available', 'Volunteer pickups':'/volunteer/pickups', 'Volunteer schedule':'/volunteer/schedule',
  'Admin dashboard':'/admin', 'Organization verification':'/admin/organizations', 'Moderate listings':'/admin/listings', 'Manage reports':'/admin/reports', 'User management':'/admin/users', 'Audit log':'/admin/audit', 'Settings':'/admin/settings',
 
  'Sign in':'/login', 'Create account':'/signup', 'Onboarding':'/onboarding', 'Admin sign in':'/admin/login',
};
export const navForRole = (role) => role === 'Donor' ? [['Donor dashboard','⌂'],['Post food','＋'],['My listings','▧'],['Pickup requests','♡'],['Pickup verification','▦'],['Donor impact','✳'],['Notifications','♧'],['Profile','◉'],['Report issue','⚑']] : role === 'Volunteer' ? [['Volunteer dashboard','⌂'],['Available pickups','⌕'],['Volunteer pickups','↗'],['Volunteer schedule','◷'],['Impact','✳'],['Notifications','♧'],['Profile','◉']] : role === 'Admin' ? [['Admin dashboard','⌂'],['Organization verification','✓'],['Moderate listings','▧'],['Manage reports','⚑'],['User management','♙'],['Audit log','◷'],['Settings','⚙']] : [['Recipient dashboard','⌂'],['Browse food','⌕'],['Saved food','♡'],['Map view','⌖'],['My claims','♡'],['My pickups','↗'],['Impact','✳'],['Notifications','♧'],['Profile','◉'],['Report issue','⚑']];
export const pathToPage = (path) => Object.entries(routeByPage).find(([, route]) => route === path)?.[0] || (path.startsWith('/food/') ? 'Food details' : path.startsWith('/pickup/pass/') ? 'Pickup pass' : path.startsWith('/donor/listings/') ? 'Donation details' : path.startsWith('/volunteer/pickups/') ? 'Pickup details' : path.startsWith('/admin/organizations/') ? 'Organization review' : path.startsWith('/admin/listings/') ? 'Listing review' : path.startsWith('/admin/reports/') ? 'Report review' : path.startsWith('/admin/users/') ? 'User detail' : path.startsWith('/admin/audit/') ? 'Audit detail' : 'Not found');
export const roles = [
  { id: 'Recipient', title: 'I’m a recipient', sub: 'NGO, shelter or community group', emoji: '⌂' },
  { id: 'Donor', title: 'I’m a donor', sub: 'Restaurant, bakery or event', emoji: '♧' },
  { id: 'Volunteer', title: 'I’m a volunteer', sub: 'Help with pickup and delivery', emoji: '♡' },
];

