import assert from "node:assert/strict";
import test from "node:test";
import {createFreightSettlementService} from "../apps/api/freight-settlement-service.js";

const actor={id:"11111111-1111-4111-8111-111111111111",role:"admin",staffSector:"finance",staffAccessLevel:3};
const plan="22222222-2222-4222-8222-222222222222";
const incident="33333333-3333-4333-8333-333333333333";
test("explicit supervised link requires finance authority and confirmation",async()=>{
  let recorded;
  const service=createFreightSettlementService({
    linkSupervision:async x=>(recorded=x,{incidentId:x.incidentId,planId:x.planId,reused:false}),
    supervision:async()=>null,
  });
  await assert.rejects(service.linkSupervision(actor,plan,{incidentId:incident}),{code:"freight_supervision_confirmation_required"});
  await assert.rejects(service.linkSupervision({...actor,staffSector:"support"},plan,{incidentId:incident,confirmed:true}));
  const result=await service.linkSupervision(actor,plan,{incidentId:incident,confirmed:true});
  assert.equal(recorded.actorId,actor.id);
  assert.equal(result.incidentId,incident);
  assert.equal(recorded.planId,plan);
  assert.equal(recorded.incidentId,incident);
  await assert.rejects(service.linkSupervision(actor,plan,{incidentId:"invalid",confirmed:true}),{code:"invalid_freight_settlement_id"});
});
