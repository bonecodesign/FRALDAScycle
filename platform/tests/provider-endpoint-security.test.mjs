import assert from "node:assert/strict";
import test from "node:test";
import {validateExternalProviderEndpoint} from "../apps/api/external-provider-endpoint.js";
import {loadConfig} from "../apps/api/config.js";
import {validateSecretsProviderConfig,resolveRuntimeEnv} from "../apps/api/secrets.js";

const unsafeEndpoints=[
  "http://provider.example.test/v1",
  "https://127.0.0.1/v1",
  "https://127.1/v1",
  "https://2130706433/v1",
  "https://10.0.0.10/v1",
  "https://172.16.0.1/v1",
  "https://192.168.1.2/v1",
  "https://169.254.169.254/latest",
  "https://[::1]/v1",
  "https://[::ffff:7f00:1]/v1",
  "https://localhost/v1",
  "https://localhost./v1",
  "https://service.localhost/v1",
  "https://service.local/v1",
  "https://metadata.google.internal/latest",
  "https://provider/v1",
  "https://user:password@provider.example.test/v1",
  "https://user@provider.example.test/v1",
  "https://provider.example.test/v1?secret=fixture",
  "https://provider.example.test/v1#fragment",
  " https://provider.example.test/v1",
  "https://provider.example.test/v1 ",
  "https://provider.example.test /v1",
  "https://",
];
const badEndpointPattern=/must (?:use HTTPS|not contain|use a public DNS hostname|be a valid HTTPS URL)/;

test("FC-314 rejects credential-bearing HTTP, local, IP, userinfo and ambiguous endpoints",()=>{
  for(const endpoint of unsafeEndpoints){
    assert.throws(()=>validateExternalProviderEndpoint(endpoint,"TEST_PROVIDER_URL"),
      badEndpointPattern,endpoint);
  }
  for(const endpoint of [
    "https://provider.example.test/v1",
    "https://provider.example.test:8443/v1",
    "https://media.example.com/sign",
    "https://geo.example.com/resolve",
  ]){
    assert.equal(validateExternalProviderEndpoint(endpoint,"TEST_PROVIDER_URL"),endpoint);
  }
  assert.equal(
    validateExternalProviderEndpoint("https://cdn.example.test/sdk.js?v=2","SDK_URL",{allowQuery:true}),
    "https://cdn.example.test/sdk.js?v=2",
  );
  assert.throws(
    ()=>validateExternalProviderEndpoint("https://cdn.example.test/sdk.js#other","SDK_URL",{allowQuery:true}),
    /must not contain/,
  );
});

test("FC-314 rejects unsafe URLs for each token-bearing API integration before server startup",()=>{
  const providers=[
    ["NOTIFICATION_WEBHOOK_URL","NOTIFICATION_WEBHOOK_SECRET"],
    ["MEDIA_PROVIDER_URL","MEDIA_PROVIDER_SECRET"],
    ["GEOCODING_PROVIDER_URL","GEOCODING_PROVIDER_SECRET"],
    ["LOGISTICS_PROVIDER_URL","LOGISTICS_PROVIDER_SECRET"],
    ["PAYMENT_PROVIDER_URL","PAYMENT_PROVIDER_SECRET"],
    ["TELEMETRY_PROVIDER_URL","TELEMETRY_PROVIDER_SECRET"],
    ["RATE_LIMIT_PROVIDER_URL","RATE_LIMIT_PROVIDER_SECRET"],
    ["LOGGI_QUOTE_PROVIDER_URL","LOGGI_QUOTE_PROVIDER_SECRET"],
    ["UBER_DIRECT_QUOTE_PROVIDER_URL","UBER_DIRECT_QUOTE_PROVIDER_SECRET"],
  ];
  for(const [urlKey,secretKey] of providers){
    for(const endpoint of unsafeEndpoints){
      assert.throws(()=>loadConfig({
        NODE_ENV:"test",[urlKey]:endpoint,[secretKey]:"synthetic-secret-fixture",
      }),badEndpointPattern,urlKey+" "+endpoint);
    }
    assert.doesNotThrow(()=>loadConfig({
      NODE_ENV:"test",[urlKey]:"https://provider.example.test/v1",
      [secretKey]:"synthetic-secret-fixture",
    }),urlKey+" should support legitimate TLS hostnames");
  }
  assert.throws(()=>loadConfig({
    NODE_ENV:"test",
    PAYMENT_PROVIDER_SDK_URL:"https://127.0.0.1/sdk.js",
    PAYMENT_PROVIDER_SDK_INTEGRITY:"sha384-synthetic-integrity",
  }),/public DNS hostname/);
  assert.equal(loadConfig({
    NODE_ENV:"test",
    PAYMENT_PROVIDER_SDK_URL:"https://cdn.example.test/sdk.js?v=3",
    PAYMENT_PROVIDER_SDK_INTEGRITY:"sha384-synthetic-integrity",
  }).paymentProviderSdkUrl,"https://cdn.example.test/sdk.js?v=3");
});

test("FC-314 vault rejects unsafe credential destinations before any Bearer token leaves the process",async()=>{
  let transportCalls=0;
  for(const endpoint of unsafeEndpoints){
    const env={
      SECRETS_PROVIDER_URL:endpoint,
      SECRETS_PROVIDER_TOKEN:"synthetic-vault-token",
      SECRETS_PROVIDER_KEYS:"SESSION_SECRET",
    };
    assert.throws(()=>validateSecretsProviderConfig(env),badEndpointPattern,endpoint);
    await assert.rejects(resolveRuntimeEnv(env,{
      async fetchImpl(){transportCalls++;assert.fail("No call is permitted for an unsafe vault URL");},
    }),badEndpointPattern,endpoint);
  }
  assert.equal(transportCalls,0);
  const safe=validateSecretsProviderConfig({
    SECRETS_PROVIDER_URL:"https://vault.example.test/resolve",
    SECRETS_PROVIDER_TOKEN:"synthetic-vault-token",
    SECRETS_PROVIDER_KEYS:"SESSION_SECRET",
  });
  assert.equal(safe.url,"https://vault.example.test/resolve");
});

test("FC-314 local loopback CORS for isolated integration tests remains independent of external providers",()=>{
  const config=loadConfig({
    NODE_ENV:"test",
    CORS_ORIGINS:"http://127.0.0.1:4101,https://admin.example.test",
  });
  assert.deepEqual(config.corsOrigins,["http://127.0.0.1:4101","https://admin.example.test"]);
});
