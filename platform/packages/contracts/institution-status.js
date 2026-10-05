const transitions=Object.freeze({
  pending:['under_review','rejected'],under_review:['active','rejected'],active:['suspended','documents_expired','closed'],
  suspended:['active','closed'],documents_expired:['under_review','active','closed'],rejected:['under_review','closed'],closed:[]
});
export function institutionTransitionAllowed(previous,next){return transitions[previous]?.includes(next)===true;}
