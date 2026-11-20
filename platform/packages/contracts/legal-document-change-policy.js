const TYPES=new Set(['material','editorial','urgent']);
const HASH=/^[a-f0-9]{64}$/;
const VERSION=/^FC-[A-Z0-9]+(?:-[A-Z0-9.]+)+$/;
const DAY=24*60*60*1000;
const fail=()=>{throw new Error('invalid_legal_document_change');};

export const LEGAL_DOCUMENT_CHANGE_POLICY=Object.freeze({
  version:'FC-LEGAL-CHANGE-1',
  normalNoticeDays:15,
  materialReacceptanceRequired:true,
  editorialReacceptanceRequired:false,
  urgentJointApprovalSectors:Object.freeze(['legal_privacy','security']),
  finalPublicationAccessLevel:5,
  preservedCapabilities:Object.freeze([
    'support','data_rights','data_export','account_deletion','existing_obligations',
  ]),
  automaticPublicationAllowed:false,
});

function exactObject(value,keys){
  return value&&typeof value==='object'&&!Array.isArray(value)
    &&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
}

export function prepareLegalDocumentChange(input){
  const keys=['type','currentVersion','nextVersion','contentHash','summary','announcedAt',
    'effectiveAt','materialImpact','editorialScopeConfirmed','urgentApprovals','founderNotified'];
  if(!exactObject(input,keys)||!TYPES.has(input.type)
    ||!VERSION.test(input.currentVersion)||!VERSION.test(input.nextVersion)
    ||input.currentVersion===input.nextVersion||!HASH.test(input.contentHash)
    ||typeof input.summary!=='string'||input.summary.trim().length<20||input.summary.trim().length>500){
    fail();
  }
  const announced=Date.parse(input.announcedAt),effective=Date.parse(input.effectiveAt);
  if(!Number.isFinite(announced)||!Number.isFinite(effective)||effective<announced)fail();
  const noticeDays=Math.floor((effective-announced)/DAY);
  let requiresReacceptance=false,jointUrgentApprovalVerified=false;
  if(input.type==='material'){
    if(input.materialImpact!==true||input.editorialScopeConfirmed!==false
      ||input.urgentApprovals!==null||input.founderNotified!==false
      ||noticeDays<LEGAL_DOCUMENT_CHANGE_POLICY.normalNoticeDays)fail();
    requiresReacceptance=true;
  }
  if(input.type==='editorial'){
    if(input.materialImpact!==false||input.editorialScopeConfirmed!==true
      ||input.urgentApprovals!==null||input.founderNotified!==false)fail();
  }
  if(input.type==='urgent'){
    if(typeof input.materialImpact!=='boolean'||input.editorialScopeConfirmed!==false
      ||input.founderNotified!==true||!Array.isArray(input.urgentApprovals)
      ||input.urgentApprovals.length!==2)fail();
    const people=new Set(),sectors=new Set();
    for(const approval of input.urgentApprovals){
      if(!exactObject(approval,['sector','actorId','approvedAt'])
        ||!LEGAL_DOCUMENT_CHANGE_POLICY.urgentJointApprovalSectors.includes(approval.sector)
        ||typeof approval.actorId!=='string'||!approval.actorId.trim()
        ||!Number.isFinite(Date.parse(approval.approvedAt)))fail();
      people.add(approval.actorId);sectors.add(approval.sector);
    }
    if(people.size!==2||sectors.size!==2)fail();
    jointUrgentApprovalVerified=true;
    requiresReacceptance=input.materialImpact;
  }
  return Object.freeze({
    policyVersion:LEGAL_DOCUMENT_CHANGE_POLICY.version,type:input.type,
    currentVersion:input.currentVersion,nextVersion:input.nextVersion,
    contentHash:input.contentHash,noticeDays,requiresCommunication:true,
    requiresReacceptance,jointUrgentApprovalVerified,
    preservedCapabilities:LEGAL_DOCUMENT_CHANGE_POLICY.preservedCapabilities,
    publicationStatus:'prepared-not-published',publicationAuthorized:false,
    finalFounderAuthorizationRequired:true,
  });
}
