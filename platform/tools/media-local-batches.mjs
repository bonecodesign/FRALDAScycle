/** FC-366: bounded, concurrent image-listing lab with artificial cases ONLY.
 * No hosted storage, real customers, publication, media provider, or persistent
 * approvals. Process isolation and actual scans are exercised only in the
 * opt-in GitHub Actions sandbox, not in the production API.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { executeClamavLocalLab } from './media-local-antivirus-lab.mjs';
import { evaluateSyntheticImageCase } from './media-local-chain.mjs';

const execFileAsync = promisify(execFile);
const CASES = new Set(['synthetic-clean','synthetic-phone','synthetic-qr','synthetic-eicar','synthetic-corrupted']);
const ORDER = ['input-av','image-decoder','webp-no-exif','output-av','ocr','qr','content-policy'];
const ID = /^[a-z][a-z0-9-]{1,45}$/;
const CLEAN = 'local-only-pass-requires-human-review';
const BLOCKED = new Set(['blocked-external-contact','blocked-qr-code',
  'blocked-threat-before-decoding','blocked-image-decoder']);

function validateAvSelfTest(av) {
  const expected = ['engineAndSigtool','dailySignatureFileRecent',
    'signatureMetadataInspected','benignSyntheticImage','eicarHarmlessTestDetected'];
  if (av?.status !== 'local-eicar-self-test-passed-not-homologated' ||
      av?.actualAvScannerExecuted !== true || !av.checks ||
      Object.keys(av.checks).length !== expected.length ||
      expected.some(name => av.checks[name] !== 'passed')) {
    throw new Error('Real ClamAV self-test not confirmed');
  }
}

function validateArtificialListings(listings) {
  if (!Array.isArray(listings) || listings.length < 1 || listings.length > 8) {
    throw new TypeError('Artificial listing batch count must be 1–8');
  }
  const ids = new Set();
  const photos = new Set();
  let total = 0;
  for (const listing of listings) {
    if (!ID.test(listing?.id ?? '') || !ID.test(listing?.ownerId ?? '') ||
        ids.has(listing.id) || !Array.isArray(listing.photos) ||
        listing.photos.length < 1 || listing.photos.length > 8) {
      throw new TypeError('Invalid artificial listing or photo count');
    }
    ids.add(listing.id);
    for (const photo of listing.photos) {
      if (!ID.test(photo?.id ?? '') || photos.has(photo.id) || !CASES.has(photo.case)) {
        throw new TypeError('Duplicate, unsafe or non-artificial photo');
      }
      photos.add(photo.id);
      total++;
    }
  }
  if (total > 16) throw new TypeError('No more than 16 artificial photos per batch');
}

/** The caller must use the real-scanner child process for real evidence.
 * On error or timeout, an ENTIRE listing is blocked; never return partial URLs.
 * A clean batch remains review-only, NOT published or approved by a human.
 */
export async function evaluateConcurrentSyntheticListings(
  listings, {processPhoto, avSelfTest, maxConcurrent = 2, photoTimeoutMs = 90000} = {},
) {
  validateArtificialListings(listings);
  validateAvSelfTest(avSelfTest);
  if (typeof processPhoto !== 'function' || !Number.isInteger(maxConcurrent) ||
      maxConcurrent < 1 || maxConcurrent > 2 || !Number.isSafeInteger(photoTimeoutMs) ||
      photoTimeoutMs < 1 || photoTimeoutMs > 90000) {
    throw new RangeError('Unsafe artificial batch worker or concurrency/timeout limit');
  }
  const jobs = listings.flatMap(listing => listing.photos.map(photo => ({
    listingId:listing.id, ownerId:listing.ownerId, photoId:photo.id, case:photo.case,
  })));
  let next = 0, active = 0, peak = 0;
  const results = new Map();
  async function worker() {
    while (next < jobs.length) {
      const job = jobs[next++];
      active++;
      peak = Math.max(peak, active);
      let timer;
      try {
        const value = await Promise.race([
          Promise.resolve().then(() => processPhoto(Object.freeze({...job}))),
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error('synthetic photo timed out')), photoTimeoutMs);
          }),
        ]);
        // Make sure workers cannot substitute the result of another listing,
        // photo or owner. Never accept "published" as a local decision.
        if (value?.listingId !== job.listingId || value.ownerId !== job.ownerId ||
            value.photoId !== job.photoId || value.case !== job.case ||
            ![CLEAN,...BLOCKED].includes(value.decision)) {
          throw new Error('Untrusted result or mismatched artificial owner/photo');
        }
        results.set(job.photoId, value.decision);
      } catch {
        // Never leak raw OCR, scanner stdout or process errors into reports.
        results.set(job.photoId, 'scan-error');
      } finally {
        clearTimeout(timer);
        active--;
      }
    }
  }
  await Promise.all(Array.from({length:Math.min(maxConcurrent,jobs.length)},()=>worker()));
  const summaries = listings.map(listing => {
    const decisions = listing.photos.map(p => results.get(p.id));
    const failed = decisions.some(x => !x || x === 'scan-error');
    return Object.freeze({
      listingId:listing.id,
      artificialPhotoCount:listing.photos.length,
      status:failed?'blocked-batch-error':decisions.every(x=>x===CLEAN)?
        'local-only-review-required':'blocked-batch',
      anyPhotoReleased:false,
      signedPreviewUrlsIssued:0,
      publicationAuthorized:false,
    });
  });
  return Object.freeze({
    id:'FC-366',
    status:'synthetic-multilisting-test-not-homologated',
    newSpendingBrl:0,
    processedPhotoCount:jobs.length,
    peakConcurrentWorkers:peak,
    maxConcurrentWorkers:maxConcurrent,
    summaries:Object.freeze(summaries),
    rawOcrTextPersisted:false,
    qrPayloadPersisted:false,
    photosPersisted:false,
    actualCustomersUsed:false,
    hostedProviderUsed:false,
    operationalReleaseAllowed:false,
    officialMediaGatesPromoted:false,
  });
}

/** Real child process: returns only a verified artificial decision, never OCR.
 * The image, OCR and scan output are retained exclusively in child memory.
 */
async function processSyntheticPhoto(job) {
  if (!CASES.has(job.case)) throw new Error('Non-artificial image request blocked');
  const script = fileURLToPath(new URL('./media-local-chain.py',import.meta.url));
  const {stdout} = await execFileAsync(process.env.PYTHON || 'python3',
    [script,'--case',job.case], {
      encoding:'utf8', timeout:90000,maxBuffer:1024*1024,
      windowsHide:true,
    });
  const parsed=JSON.parse(stdout);
  if (parsed?.schemaVersion !== 1 ||
      JSON.stringify(parsed.pipelineOrder) !== JSON.stringify(ORDER) ||
      !Array.isArray(parsed.cases) || parsed.cases.length !== 1) {
    throw new Error('Synthetic child chain incomplete');
  }
  const safe=evaluateSyntheticImageCase(parsed.cases[0],job.case);
  return { ...job,decision:safe.decision };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  try {
    const avSelfTest = executeClamavLocalLab();
    const listings = [
      {id:'listing-a',ownerId:'owner-a',photos:[{id:'photo-a1',case:'synthetic-clean'}]},
      {id:'listing-b',ownerId:'owner-b',photos:[
        {id:'photo-b1',case:'synthetic-clean'},{id:'photo-b2',case:'synthetic-phone'},
      ]},
      {id:'listing-c',ownerId:'owner-c',photos:[
        {id:'photo-c1',case:'synthetic-qr'},{id:'photo-c2',case:'synthetic-eicar'},
        {id:'photo-c3',case:'synthetic-corrupted'},
      ]},
    ];
    const result=await evaluateConcurrentSyntheticListings(listings,{
      processPhoto:processSyntheticPhoto, avSelfTest, maxConcurrent:2,
    });
    const expected=['local-only-review-required','blocked-batch','blocked-batch'];
    if (result.peakConcurrentWorkers !== 2 ||
        result.summaries.some((item,i)=>item.status !== expected[i])) {
      throw new Error('The actual concurrent scenario did not match expected security outcomes');
    }
    console.log(JSON.stringify(result,null,2));
  } catch {
    // Never log unsafe child output, OCR text, file path, or scanner signature.
    console.error('FC-366 BLOCKED: real concurrent artificial media batches unverified');
    process.exitCode=2;
  }
}
