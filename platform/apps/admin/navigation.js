const adminNavIcons={
  '/admin/dashboard':'<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
  '/admin/users':'<path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/>',
  '/admin/roles':'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
  '/admin/ads':'<path d="m21 8-9-5-9 5 9 5 9-5Z"/><path d="m3 8 9 5 9-5M3 13l9 5 9-5"/>',
  '/admin/operations':'<path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  '/admin/finance':'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  '/admin/logistics':'<path d="M10 17h4V5H2v12h3"/><path d="M14 9h4l4 4v4h-3"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="17.5" r="2.5"/>',
  '/admin/reports':'<path d="M3 3v18h18"/><path d="m7 16 4-5 4 3 5-7"/>',
  '/admin/data':'<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/>',
  '/admin/forecast':'<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 6-7"/><path d="M16 7h4v4"/>',
  '/admin/infrastructure':'<rect x="3" y="3" width="18" height="6" rx="1"/><rect x="3" y="15" width="18" height="6" rx="1"/><path d="M7 6h.01M7 18h.01"/>',
  '/admin/partnerships':'<path d="M16 11c1.7 0 3-1.3 3-3s-1.3-3-3-3M8 11c-1.7 0-3-1.3-3-3s1.3-3 3-3M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0"/>',
  '/admin/innovation':'<path d="M9 18h6M10 22h4"/><path d="M8.5 14.5A7 7 0 1 1 15.5 14.5C14.5 15.4 14 16 14 18h-4c0-2-.5-2.6-1.5-3.5Z"/>',
  '/admin/launch':'<path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2"/><path d="M9 15 4 10l5-1 6-6c3-3 6-2 6-2s1 3-2 6l-6 6-1 5-5-5"/><circle cx="16" cy="6" r="1"/>',
  '/admin/alerts':'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  '/admin/moderation':'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="M8 12h8"/>',
  '/admin/audit':'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h8"/><path d="M14 2v6h6M9 13h6M9 17h4"/><circle cx="18" cy="17" r="3"/><path d="m20 19 2 2"/>',
  '/admin/settings':'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>',
  '/admin/security':'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  '/site/home':'<path d="M14 3h7v7M10 14 21 3"/><path d="M21 14v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h6"/>'
};

const adminNavGroups=[
  {label:'Visão geral',paths:['/admin/dashboard']},
  {label:'Gestão',paths:['/admin/users','/admin/roles','/admin/ads','/admin/operations','/admin/logistics']},
  {label:'Financeiro',paths:['/admin/finance']},
  {label:'Inteligência',paths:['/admin/reports','/admin/data','/admin/forecast']},
  {label:'Estratégia',paths:['/admin/partnerships','/admin/innovation','/admin/launch']},
  {label:'Sistema',paths:['/admin/alerts','/admin/moderation','/admin/audit','/admin/infrastructure','/admin/settings','/admin/security']},
  {label:'Atalhos',paths:['/site/home']}
];

function setupAdminNavigation(){
  const root=document.querySelector('main[data-surface="admin"]');
  if(root?.dataset.adminNavigation==='true')return;
  const sidebar=document.querySelector('.admin-sidebar');
  if(!sidebar)return;
  const links=[...sidebar.querySelectorAll('a')];
  links.forEach(link=>{
    const path=new URL(link.href,window.location.origin).pathname.replace(/\.html$/,'');
    const drawing=adminNavIcons[path]||adminNavIcons['/admin/dashboard'];
    const label=link.textContent.trim().replace(/^\S+\s+/, '');
    link.textContent='';
    link.insertAdjacentHTML('beforeend',`<svg class="fc-icon admin-nav-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${drawing}</svg>`);
    const text=document.createElement('span');text.textContent=label;link.append(text);
    if(link.classList.contains('active'))link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
  });
  adminNavGroups.forEach(group=>{
    const firstLink=links.find(link=>group.paths.includes(new URL(link.href,window.location.origin).pathname.replace(/\.html$/,'')));
    if(!firstLink)return;
    const heading=document.createElement('span');
    heading.className='admin-nav-group';
    heading.textContent=group.label;
    firstLink.before(heading);
  });
  if(root)root.dataset.adminNavigation='true';
}

setupAdminNavigation();
