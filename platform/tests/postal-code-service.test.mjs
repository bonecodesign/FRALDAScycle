import assert from "node:assert/strict";
import test from "node:test";
import { createPostalCodeService } from "../apps/api/postal-code-service.js";

test("consulta ViaCEP no servidor e produz endereço e evidência normalizados", async () => {
  let requested;
  const service = createPostalCodeService({ fetchImpl: async (url, options) => {
    requested = { url, options };
    return { ok: true, async json() { return { cep: "30110-028", logradouro: "Avenida Afonso Pena", bairro: "Centro", localidade: "Belo Horizonte", uf: "mg" }; } };
  } });
  const result = await service.lookup("30110-028");
  assert.equal(requested.url, "https://viacep.com.br/ws/30110028/json/");
  assert.equal(requested.options.headers.accept, "application/json");
  assert.deepEqual(result.address, { postalCode: "30110028", street: "Avenida Afonso Pena", district: "Centro", city: "Belo Horizonte", state: "MG" });
  assert.equal(result.evidence.provider, "viacep");
  assert.equal(result.evidence.exactMatch, true);
});

test("falha fechada para CEP inexistente, resposta divergente e indisponibilidade", async () => {
  const missing = createPostalCodeService({ fetchImpl: async () => ({ ok: true, async json() { return { erro: true }; } }) });
  await assert.rejects(missing.lookup("30110028"), error => error.code === "postal_code_not_found" && error.status === 422);
  const mismatch = createPostalCodeService({ fetchImpl: async () => ({ ok: true, async json() { return { cep: "30110-029", localidade: "Belo Horizonte", uf: "MG" }; } }) });
  await assert.rejects(mismatch.lookup("30110028"), error => error.code === "invalid_postal_provider_response" && error.status === 502);
  const unavailable = createPostalCodeService({ fetchImpl: async () => { throw new Error("offline"); } });
  await assert.rejects(unavailable.lookup("30110028"), error => error.code === "postal_provider_unavailable" && error.status === 503);
});

test("FC-313: rejects invented states and malformed ViaCEP locality instead of exposing false evidence",async()=>{
  const original={cep:"30110-028",logradouro:"Avenida Afonso Pena",bairro:"Centro",localidade:"Belo Horizonte",uf:"MG"};
  for(const change of [
    {uf:"XX"},{uf:"CA"},{uf:"ZZ"},{uf:"M"},{uf:null},{uf:{}},{uf:[]},{uf:17},
    {localidade:null},{localidade:[]},{localidade:{name:"Belo Horizonte"}},
    {localidade:" "},{localidade:"A"},{localidade:"x".repeat(121)},
    {logradouro:{}},{logradouro:42},{logradouro:"x".repeat(256)},
    {bairro:[]},{bairro:"x".repeat(256)},
    {localidade:"Be\u0000lo Horizonte"},
  ]){
    const service=createPostalCodeService({fetchImpl:async()=>({
      ok:true,async json(){return {...original,...change};},
    })});
    await assert.rejects(service.lookup("30110028"),
      error=>error.code==="invalid_postal_provider_response"&&error.status===502,
      JSON.stringify(change));
  }
  const valid=createPostalCodeService({fetchImpl:async()=>({
    ok:true,async json(){return {...original,uf:" mg ",logradouro:null,bairro:undefined,localidade:" Belo Horizonte "};},
  })});
  const result=await valid.lookup("30110028");
  assert.deepEqual(result.address,{
    postalCode:"30110028",street:"",district:"",city:"Belo Horizonte",state:"MG",
  });
  assert.equal(result.evidence.exactMatch,true);
});

test("FC-313: a hanging fetch cannot bypass the deadline even when it ignores abort",async()=>{
  let signal;
  const service=createPostalCodeService({
    timeoutMs:70,
    fetchImpl:async(_url,options)=>{signal=options.signal;return new Promise(()=>{});},
  });
  await assert.rejects(service.lookup("30110028"),
    error=>error.code==="postal_provider_unavailable"&&error.status===503);
  assert.equal(signal.aborted,true);
});

test("FC-313: a stalled response.json obeys the same overall deadline",async()=>{
  let signal;
  const service=createPostalCodeService({
    timeoutMs:70,
    fetchImpl:async(_url,options)=>{
      signal=options.signal;
      return {ok:true,async json(){return new Promise(()=>{});}};
    },
  });
  await assert.rejects(service.lookup("30110028"),
    error=>error.code==="postal_provider_unavailable"&&error.status===503);
  assert.equal(signal.aborted,true);
});

test("FC-313: redirects are forbidden and invalid provider shapes always fail closed",async()=>{
  let redirect;
  const providers=[null,[],false,"unexpected",23,{erro:false}];
  for(const payload of providers){
    const service=createPostalCodeService({fetchImpl:async(_url,options)=>{
      redirect=options.redirect;
      return {ok:true,async json(){return payload;}};
    }});
    await assert.rejects(service.lookup("30110028"),
      error=>error.code==="invalid_postal_provider_response"&&error.status===502);
    assert.equal(redirect,"error");
  }
});

test("FC-313: postal provider deadline cannot be disabled or increased silently",()=>{
  for(const timeoutMs of [null,0,-1,1.5,NaN,Infinity,5001,"5000"]){
    assert.throws(()=>createPostalCodeService({timeoutMs}),RangeError);
  }
});
