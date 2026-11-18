import assert from "node:assert/strict";
import test from "node:test";
import { createMarketplaceProviders, ProviderError } from "../apps/api/marketplace-providers.js";
import { createApiServer } from "../apps/api/server.js";
import { loadConfig } from "../apps/api/config.js";

const configured = {
  mediaProviderUrl: "https://media.example.com/sign",
  mediaProviderSecret: "media-secret",
  geocodingProviderUrl: "https://geo.example.com/resolve",
  geocodingProviderSecret: "geo-secret",
};

function response(payload, ok = true) {
  return { ok, async json() { return payload; } };
}

test("signed uploads validate media and keep provider credentials server-side", async () => {
  let request;
  const providers = createMarketplaceProviders(configured, async (url, options) => {
    request = { url, options };
    return response({
      uploadUrl: "https://storage.example.com/upload/one",
      storageKey: "listings/user-1/one.webp",
      expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      headers: { "x-storage-token": "opaque" },
    });
  });
  const result = await providers.signedUpload("user-1", { contentType: "image/webp", sizeBytes: 2048 });
  assert.equal(result.storageKey, "listings/user-1/one.webp");
  assert.match(request.options.headers.authorization, /^Bearer /);
  assert.doesNotMatch(JSON.stringify(result), /media-secret/);
  await assert.rejects(
    providers.signedUpload("user-1", { contentType: "text/html", sizeBytes: 10 }),
    (error) => error instanceof ProviderError && error.code === "invalid_media_type",
  );
});

test("signed uploads reject foreign keys, unsafe headers and invalid expiration", async () => {
  for (const payload of [
    {
      uploadUrl: "https://storage.example.com/upload/one",
      storageKey: "listings/another-user/one.webp",
      expiresAt: new Date(Date.now() + 60_000).toISOString(), headers: {},
    },
    {
      uploadUrl: "https://storage.example.com/upload/one",
      storageKey: "listings/user-1/one.webp",
      expiresAt: new Date(Date.now() + 60_000).toISOString(), headers: { authorization: "secret" },
    },
    {
      uploadUrl: "https://storage.example.com/upload/one",
      storageKey: "listings/user-1/one.webp",
      expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(), headers: {},
    },
    {
      uploadUrl: "https://user:secret@storage.example.com/upload/one",
      storageKey: "listings/user-1/one.webp",
      expiresAt: new Date(Date.now() + 60_000).toISOString(), headers: {},
    },
  ]) {
    const providers = createMarketplaceProviders(configured, async () => response(payload));
    await assert.rejects(
      providers.signedUpload("user-1", { contentType: "image/webp", sizeBytes: 2_048 }),
      (error) => error.code === "invalid_provider_response" && error.status === 502,
    );
  }
});

test("FC-316: provider-signed media URLs cannot target private/local hosts; signed queries survive", async () => {
  const owner = "synthetic-owner";
  const storageKey = "listings/synthetic-owner/one.webp";
  const expiresAt = new Date(Date.now() + 60_000).toISOString();
  const destinations = [
    "https://127.0.0.1/file?X-Amz-Signature=synthetic",
    "https://[::1]/file",
    "https://169.254.169.254/metadata",
    "https://localhost/file",
    "https://bucket.localhost/file",
    "https://objects.internal/file",
    "https://user:password@storage.example.test/file",
    "https://storage.example.test/file#unexpected",
  ];

  function providerFor(signedUrl) {
    return createMarketplaceProviders(configured, async (_endpoint, options) => {
      const { operation } = JSON.parse(options.body);
      if (operation === "signed-upload") return response({
        storageKey, uploadUrl: signedUrl, expiresAt, headers: {},
      });
      if (operation === "signed-read") return response({ readUrl: signedUrl, expiresAt });
      throw new Error("Unexpected operation");
    });
  }

  for (const signedUrl of destinations) {
    const providers = providerFor(signedUrl);
    await assert.rejects(
      providers.signedUpload(owner, { contentType: "image/webp", sizeBytes: 1_024 }),
      error => error.code === "invalid_provider_response" && error.status === 502,
      "upload: " + signedUrl,
    );
    await assert.rejects(
      providers.signedProofRead(owner, storageKey),
      error => error.code === "invalid_provider_response" && error.status === 502,
      "read: " + signedUrl,
    );
  }

  // Signed links legitimately include query tokens and may use a different
  // public storage hostname from the configured media API.
  const signedUrl = "https://objects.example.test/file?X-Amz-Signature=synthetic&X-Amz-Expires=300";
  const providers = providerFor(signedUrl);
  const upload = await providers.signedUpload(owner, { contentType: "image/webp", sizeBytes: 1_024 });
  const read = await providers.signedProofRead(owner, storageKey);
  assert.equal(upload.uploadUrl, signedUrl);
  assert.equal(read.readUrl, signedUrl);
});

test("media verification rejects missing, foreign, mutable and unprocessed images", async () => {
  const key = "listings/user-1/one.webp";
  const ready = { storageKey: key, ownerId: "user-1", exists: true, processed: true,
    immutable: true, contentType: "image/webp", exifRemoved: true, scanStatus: "clean",
    contactScanStatus:'clear',contactRuleVersion:'FC-CONTENT-1',ocrTextStored:false,qrCodeDetected:false,contactReasons:[],
    sizeBytes: 2_048, width: 800, height: 800 };
  for (const patch of [
    { exists: false }, { ownerId: "another-user" }, { processed: false },
    { immutable: false }, { contentType: "text/html" }, { exifRemoved: false },
    { scanStatus: "pending" }, { contactScanStatus:'pending' }, { contactRuleVersion:'old' },
    { ocrTextStored:true }, { qrCodeDetected:true }, { contactReasons:['phone'] },
    // Missing/ambiguous results cannot be treated as a completed contact scan.
    { contactScanStatus: undefined }, { contactRuleVersion: undefined },
    { ocrTextStored: undefined }, { qrCodeDetected: undefined },
    { contactReasons: undefined }, { contactReasons: null },
    { contactReasons: ['external_contact'] }, { scanStatus: undefined },
    { sizeBytes: 10_000_001 }, { width: 1_601 }, { height: 0 },
  ]) {
    const providers = createMarketplaceProviders(configured, async () => response({ ...ready, ...patch }));
    await assert.rejects(providers.verifyListingMedia("user-1", [key]), error => error.code === "media_not_ready");
  }
  let request;
  const providers = createMarketplaceProviders(configured, async (_url, options) => {
    request = JSON.parse(options.body); return response(ready);
  });
  assert.deepEqual(await providers.verifyListingMedia("user-1", [key]), { verified: true, count: 1 });
  assert.equal(request.operation, "verify-listing-media");
  assert.equal(request.ownerId, "user-1");
  assert.equal(request.contactRuleVersion,'FC-CONTENT-1');assert.equal(request.requireOcr,true);assert.equal(request.requireQrDetection,true);assert.equal(request.storeOcrText,false);
  await assert.rejects(providers.verifyListingMedia("user-1", ["listings/other/one.webp"]), error => error.code === "invalid_media");
});

test("geocoding returns only approximate validated coordinates", async () => {
  const providers = createMarketplaceProviders(configured, async () => response({
    latitude: -19.9167, longitude: -43.9345, city: "Belo Horizonte", state: "mg",
  }));
  assert.deepEqual(await providers.geocode("user-1", { address: "Castelo, Belo Horizonte - MG" }), {
    latitude: -19.9167, longitude: -43.9345, city: "Belo Horizonte", state: "MG", approximate: true,
  });
});

test("unconfigured integrations fail explicitly without weakening production", async () => {
  const providers = createMarketplaceProviders({});
  await assert.rejects(
    providers.signedUpload("user-1", { contentType: "image/png", sizeBytes: 20 }),
    (error) => error.code === "provider_not_configured" && error.status === 503,
  );
});

test("provider HTTP endpoints require a valid user session", async (context) => {
  const authService = { async session(token) { return token === "valid" ? { id: "user-1" } : null; } };
  const marketplaceProviders = {
    async signedUpload(userId) { return { storageKey: `listings/${userId}/one.webp`, uploadUrl: "https://storage.example.com/one" }; },
    async geocode() { return { latitude: -19.9, longitude: -43.9, approximate: true }; },
  };
  const server = createApiServer({
    config: loadConfig({ NODE_ENV: "test" }), authService, marketplaceProviders,
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => server.close());
  const origin = `http://127.0.0.1:${server.address().port}`;

  const denied = await fetch(`${origin}/v1/media/uploads`, {
    method: "POST", headers: { "content-type": "application/json" }, body: "{}",
  });
  assert.equal(denied.status, 401);

  const allowed = await fetch(`${origin}/v1/media/uploads`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: "fc_session=valid" },
    body: JSON.stringify({ contentType: "image/webp", sizeBytes: 100 }),
  });
  assert.equal(allowed.status, 201);
  assert.equal((await allowed.json()).upload.storageKey, "listings/user-1/one.webp");
});

test("media provider authenticated calls forbid redirects and fail closed on redirect errors", async () => {
  let requestOptions;
  const providers = createMarketplaceProviders(configured, async (_url, options) => {
    requestOptions = options;
    throw new TypeError("redirect refused");
  });
  await assert.rejects(
    providers.verifyListingMedia("user-1", ["listings/user-1/one.webp"]),
    error => error.code === "provider_unavailable" && error.status === 503,
  );
  assert.equal(requestOptions.method, "POST");
  assert.equal(requestOptions.redirect, "error");
  assert.match(requestOptions.headers.authorization, /^Bearer /);
});

test("media provider never-settling fetch cannot freeze publication even when abort is ignored", async () => {
  let signal;
  const providers = createMarketplaceProviders(configured, async (_url, options) => {
    signal = options.signal;
    return new Promise(() => {}); // Adapter intentionally ignores abort.
  }, { timeoutMs: 60 });
  await assert.rejects(
    providers.verifyListingMedia("user-1", ["listings/user-1/one.webp"]),
    error => error instanceof ProviderError && error.code === "provider_unavailable" && error.status === 503,
  );
  assert.equal(signal.aborted, true);
});

test("stalled provider JSON parsing obeys the same deadline as the fetch", async () => {
  let signal;
  const providers = createMarketplaceProviders(configured, async (_url, options) => {
    signal = options.signal;
    return { ok: true, json: async () => new Promise(() => {}) };
  }, { timeoutMs: 60 });
  await assert.rejects(
    providers.signedUpload("user-1", { contentType: "image/webp", sizeBytes: 100 }),
    error => error.code === "provider_unavailable" && error.status === 503,
  );
  assert.equal(signal.aborted, true);
});

test("null or array provider JSON cannot become a successful media or geocoding response", async () => {
  for (const body of [null, [], "ok", 42]) {
    const providers = createMarketplaceProviders(configured, async () => response(body), { timeoutMs: 100 });
    await assert.rejects(
      providers.signedUpload("user-1", { contentType: "image/webp", sizeBytes: 100 }),
      error => error.code === "invalid_provider_response" && error.status === 502,
    );
    await assert.rejects(
      providers.geocode("user-1", { address: "Belo Horizonte, Minas Gerais" }),
      error => error.code === "invalid_provider_response" && error.status === 502,
    );
  }
});

test("media provider deadline is positive, bounded and cannot be silently disabled", () => {
  for (const timeoutMs of [0, -1, NaN, Infinity, 8_001, "8000", null]) {
    assert.throws(
      () => createMarketplaceProviders(configured, fetch, { timeoutMs }),
      RangeError,
    );
  }
});

test("FC-310: synthetic upload -> two-photo verification -> signed review read is bound to the owner", async () => {
  const owner = "synthetic-owner", keys = ["listings/synthetic-owner/one.webp","listings/synthetic-owner/two.webp"];
  const operations = [];
  const mock = async (_endpoint, options) => {
    assert.equal(options.method, "POST");
    assert.equal(options.redirect, "error");
    assert.match(options.headers.authorization, /^Bearer /);
    const body = JSON.parse(options.body);
    operations.push(body);
    if (body.operation === "signed-upload") return response({
      storageKey:keys[0],uploadUrl:"https://storage.example.test/upload/token",
      expiresAt:new Date(Date.now()+120000).toISOString(),headers:{"x-upload-token":"synthetic"},
    });
    if (body.operation === "verify-listing-media") return response({
      storageKey:body.storageKey,ownerId:body.ownerId,exists:true,processed:true,immutable:true,
      contentType:"image/webp",exifRemoved:true,scanStatus:"clean",contactScanStatus:"clear",
      contactRuleVersion:"FC-CONTENT-1",ocrTextStored:false,qrCodeDetected:false,
      contactReasons:[],sizeBytes:2048,width:640,height:480,
    });
    if (body.operation === "signed-read") return response({
      readUrl:"https://storage.example.test/read/token",expiresAt:new Date(Date.now()+90000).toISOString(),
    });
    throw new Error("Unexpected operation: " + body.operation);
  };
  const providers=createMarketplaceProviders(configured,mock);
  const upload=await providers.signedUpload(owner,{contentType:"image/png",sizeBytes:2048});
  assert.equal(upload.storageKey,keys[0]);
  assert.equal(await providers.verifyListingMedia(owner,keys).then(result=>result.count),2);
  const read=await providers.signedListingRead(owner,{storageKey:keys[0]});
  assert.match(read.readUrl,/^https:\/\/storage\.example\.test\/read\//);
  assert.deepEqual(operations.map(item=>item.operation),[
    "signed-upload","verify-listing-media","verify-listing-media","verify-listing-media","signed-read",
  ]);
  assert.ok(operations.filter(item=>item.operation==="verify-listing-media").every(item=>
    item.requireOcr===true && item.requireQrDetection===true && item.storeOcrText===false
      && item.contactRuleVersion==="FC-CONTENT-1" && item.ownerId===owner));
  assert.doesNotMatch(JSON.stringify({upload,read}),/media-secret/);
  const count=operations.length;
  await assert.rejects(providers.signedListingRead("other-account",{storageKey:keys[0]}),
    error=>error.code==="invalid_media" && error.status===422);
  assert.equal(operations.length,count,"Other owners must be rejected before any request to the provider");
});

test("FC-310: multi-photo verification never accepts partial evidence or serves a review URL", async () => {
  const keys=["listings/synthetic-owner/clean.webp","listings/synthetic-owner/not-ready.webp"];
  const operations=[];
  const providers=createMarketplaceProviders(configured,async(_endpoint,options)=>{
    const body=JSON.parse(options.body);operations.push(body.operation);
    if(body.operation==="signed-read")throw new Error("Unverified image must not receive a signed URL");
    return response({
      storageKey:body.storageKey,ownerId:body.ownerId,exists:true,processed:true,
      immutable:true,contentType:"image/webp",exifRemoved:true,scanStatus:"clean",
      contactScanStatus:body.storageKey===keys[1]?"pending":"clear",
      contactRuleVersion:"FC-CONTENT-1",ocrTextStored:false,qrCodeDetected:false,
      contactReasons:[],sizeBytes:2048,width:640,height:480,
    });
  });
  await assert.rejects(providers.verifyListingMedia("synthetic-owner",keys),
    error=>error.code==="media_not_ready"&&error.status===409);
  await assert.rejects(providers.signedListingRead("synthetic-owner",{storageKey:keys[1]}),
    error=>error.code==="media_not_ready"&&error.status===409);
  assert.deepEqual(operations,["verify-listing-media","verify-listing-media","verify-listing-media"]);
});

test("FC-312: missing, coerced or non-finite coordinates fail closed instead of defaulting to 0,0",async()=>{
  const wrong=[
    {latitude:null,longitude:null},
    {latitude:null,longitude:-43.9345},
    {latitude:-19.9167,longitude:null},
    {latitude:"",longitude:""},
    {latitude:"-19.9167",longitude:"-43.9345"},
    {latitude:false,longitude:0},
    {latitude:true,longitude:0},
    {latitude:[],longitude:-43.9345},
    {latitude:{value:-19.9167},longitude:-43.9345},
    {latitude:NaN,longitude:-43.9345},
    {latitude:Infinity,longitude:-43.9345},
    {latitude:-91,longitude:-43.9345},
    {latitude:-19.9167,longitude:181},
    {latitude:undefined,longitude:-43.9345},
  ];
  for(const payload of wrong){
    const providers=createMarketplaceProviders(configured,async()=>response(payload));
    await assert.rejects(
      providers.geocode("user-1",{address:"Belo Horizonte - MG, Brasil"}),
      error=>error instanceof ProviderError && error.code==="invalid_provider_response" && error.status===502,
      JSON.stringify(payload),
    );
  }
  // Numeric zero itself is valid geometry; only implicit conversion to zero is forbidden.
  const zero=createMarketplaceProviders(configured,async()=>response({latitude:0,longitude:0}));
  assert.deepEqual(await zero.geocode("user-1",{address:"Endereço sintético de validação"}),{
    latitude:0,longitude:0,city:null,state:null,approximate:true,
  });
});

test("FC-312: geocoding address and upload size types are validated before external calls",async()=>{
  let calls=0;
  const providers=createMarketplaceProviders(configured,async()=>{
    calls++;
    return response({latitude:-19.9167,longitude:-43.9345});
  });
  for(const address of [null,0,true,[],{}, {street:"Av. Brasil"},["Av. Brasil"],"    ","a"]){
    await assert.rejects(providers.geocode("user-1",{address}),
      error=>error.code==="invalid_address" && error.status===422);
  }
  for(const sizeBytes of [null,"2048",true,false,[],[2048],{},1.5,-1,0,Infinity,10_000_001]){
    await assert.rejects(providers.signedUpload("user-1",{contentType:"image/png",sizeBytes}),
      error=>error.code==="invalid_media_size" && error.status===422);
  }
  assert.equal(calls,0,"Invalid input must never contact a provider");
});

test("FC-312: HTTP geocoding returns a safe 502 for incomplete provider coordinates",async context=>{
  const providers=createMarketplaceProviders(configured,async()=>response({latitude:null,longitude:""}));
  const server=createApiServer({
    config:loadConfig({NODE_ENV:"test"}),
    authService:{async session(cookie){return cookie==="valid"?{id:"synthetic-geo-user"}:null;}},
    marketplaceProviders:providers,
  });
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  context.after(()=>server.close());
  const origin="http://127.0.0.1:"+server.address().port;
  const payload={address:"Belo Horizonte, Minas Gerais"};
  const denied=await fetch(origin+"/v1/geocoding/resolve",{
    method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload),
  });
  assert.equal(denied.status,401);
  const invalid=await fetch(origin+"/v1/geocoding/resolve",{
    method:"POST",
    headers:{"content-type":"application/json",cookie:"fc_session=valid"},
    body:JSON.stringify(payload),
  });
  const body=await invalid.json();
  assert.equal(invalid.status,502,JSON.stringify(body));
  assert.equal(body.error.code,"invalid_provider_response");
  assert.equal(Object.hasOwn(body,"location"),false);
  assert.equal(invalid.headers.get("cache-control"),"no-store");
});

test("FC-312: provider cannot invent Brazilian state via truncation or stringify malformed city",async()=>{
  for(const patch of [
    {city:{name:"Belo Horizonte"}},{city:42},{city:"x".repeat(121)},{city:"   "},
    {state:"California"},{state:"XX"},{state:123},{state:{code:"MG"}},
    {state:"CA"},{state:"M"},{state:"MGxxx"},{state:[]},
  ]){
    const providers=createMarketplaceProviders(configured,async()=>response({
      latitude:-19.9167,longitude:-43.9345,city:"Belo Horizonte",state:"MG",...patch,
    }));
    await assert.rejects(providers.geocode("user-1",{address:"Castelo, Belo Horizonte - MG"}),
      error=>error.code==="invalid_provider_response"&&error.status===502,
      JSON.stringify(patch));
  }
  const providers=createMarketplaceProviders(configured,async()=>response({
    latitude:-19.9167,longitude:-43.9345,city:"  Belo Horizonte  ",state:" mg ",
  }));
  assert.deepEqual(await providers.geocode("user-1",{address:"Castelo, Belo Horizonte - MG"}),{
    latitude:-19.9167,longitude:-43.9345,city:"Belo Horizonte",state:"MG",approximate:true,
  });
});

test("FC-314: direct media and geocoding adapters never send Bearer credentials to unsafe endpoints",async()=>{
  let outboundCalls=0;
  const fetchImpl=async()=>{outboundCalls++;throw new Error("No outbound request should be sent");};
  for(const endpoint of [
    "https://127.0.0.1/verify",
    "https://169.254.169.254/latest",
    "https://localhost/verify",
    "https://metadata.google.internal/verify",
    "https://user:password@media.example.test/verify",
    "https://media.example.test/verify?credential=unexpected",
  ]){
    const providers=createMarketplaceProviders({
      ...configured,mediaProviderUrl:endpoint,geocodingProviderUrl:endpoint,
    },fetchImpl);
    await assert.rejects(
      providers.signedUpload("user-1",{contentType:"image/webp",sizeBytes:100}),
      error=>error.code==="provider_not_configured"&&error.status===503,
    );
    await assert.rejects(
      providers.geocode("user-1",{address:"Belo Horizonte, MG"}),
      error=>error.code==="provider_not_configured"&&error.status===503,
    );
  }
  assert.equal(outboundCalls,0);
});
