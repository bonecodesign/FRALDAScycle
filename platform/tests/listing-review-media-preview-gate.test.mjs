import assert from 'node:assert/strict';
import test from 'node:test';
import { verifiedListingReviewMedia } from '../apps/api/admin-handler.js';

const owner = '11111111-1111-4111-8111-111111111111';
const reviewer = '22222222-2222-4222-8222-222222222222';
const images = [
  { storage_key: `listings/${owner}/one.webp`, media_type: 'image/webp', position: 1 },
  { storage_key: `listings/${owner}/two.webp`, media_type: 'image/webp', position: 2 },
];
const valid = () => ({
  listing: { seller_id: owner, status: 'review' },
  media: images.map(row => ({ ...row })),
});
const providerFixture = ({ verified = true, count = 2, error = null } = {}) => {
  const calls = [];
  const provider = {
    async verifyListingMedia(userId, keys) {
      calls.push({ type: 'verify', userId, keys });
      if (error) throw error;
      return { verified, count };
    },
    async signedProofRead(userId, key) {
      calls.push({ type: 'sign', userId, key });
      return {
        readUrl: 'https://media.example.test/review?key=synthetic',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      };
    },
  };
  return { provider, calls };
};

test('FC-359: both images verified as a complete batch BEFORE either temporary URL is issued', async () => {
  const { provider, calls } = providerFixture();
  const media = await verifiedListingReviewMedia(provider, valid(), reviewer);
  assert.equal(calls.length, 3);
  assert.deepEqual(calls[0], { type: 'verify', userId: owner, keys: images.map(row => row.storage_key) });
  assert.ok(calls.slice(1).every(call => call.type === 'sign' && call.userId === reviewer));
  assert.equal(media.length, 2);
  assert.ok(media.every(row => row.readUrl.startsWith('https://') && row.storage_key === undefined));
  assert.equal(JSON.stringify(media).includes('storage_key'), false, 'private object keys stay out of HTTP JSON');
  assert.equal(media[0].position, 1);
  assert.equal(media[1].position, 2);
});

test('FC-359: unavailable, invalid or partial processing blocks ALL signed URLs', async () => {
  for (const options of [
    {verified:false,count:2}, {verified:true,count:1},
    {verified:null,count:2}, {verified:true,count:null},
    {error:Object.assign(new Error('Imagem sintética pendente'),{code:'media_not_ready',status:409})},
  ]) {
    const {provider,calls} = providerFixture(options);
    await assert.rejects(
      verifiedListingReviewMedia(provider,valid(),reviewer),
      error => error.code === 'media_not_ready',
    );
    assert.equal(calls.length,1,'never issue a URL before the entire batch passes');
    assert.equal(calls[0].type,'verify');
  }
  const {provider,calls} = providerFixture();
  await assert.rejects(
    verifiedListingReviewMedia({...provider,verifyListingMedia:null},valid(),reviewer),
    e=>e.code==='media_provider_unavailable'&&e.status===503,
  );
  await assert.rejects(
    verifiedListingReviewMedia({...provider,signedProofRead:null},valid(),reviewer),
    e=>e.code==='media_provider_unavailable'&&e.status===503,
  );
  assert.equal(calls.length,0);
});

test('FC-359: unexpected review state or incomplete/foreign image batch fails before provider access', async () => {
  const {provider,calls} = providerFixture();
  const variants = [
    {...valid(),listing:{seller_id:owner,status:'published'}},
    {...valid(),listing:{seller_id:owner,status:'removed'}},
    {...valid(),media:[]},
    {...valid(),media:images.concat(images)},
    {...valid(),media:[{storage_key:`listings/${reviewer}/foreign.webp`}]},
    {...valid(),media:[{storage_key:`listings/${owner}/../unsafe.webp`}]},
    {...valid(),media:Array.from({length:9},(_,i)=>({storage_key:`listings/${owner}/${i}.webp`}))},
    {...valid(),media:[null]},
    {...valid(),media:null},
    {...valid(),listing:{seller_id:null,status:'review'}},
  ];
  for (const detail of variants) {
    await assert.rejects(
      verifiedListingReviewMedia(provider,detail,reviewer),
      err=>err.code==='listing_review_conflict'||err.code==='listing_media_required',
    );
    assert.equal(calls.length,0,'no provider access when review context is invalid');
  }
});
