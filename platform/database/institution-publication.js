export async function institutionPublicationAllowed(client,listing){
 if(listing.kind!=='donation')return true;
 const institution=(await client.query('SELECT status,open_packages_accepted FROM institutions WHERE id=$1 FOR SHARE',[listing.institution_id])).rows[0];
 return institution?.status==='active'&&(listing.package_condition!=='open'||institution.open_packages_accepted===true);
}
