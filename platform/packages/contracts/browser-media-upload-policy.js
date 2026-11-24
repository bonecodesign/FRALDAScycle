// Second boundary in the browser after the server validates a signed URL.
// Does not replace the provider, DNS/egress policy or human image review.
const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const forbiddenHeaders = new Set([
  'authorization', 'cookie', 'cookie2', 'host', 'origin', 'referer',
  'proxy-authorization', 'proxy-authenticate', 'set-cookie',
]);
const keyPattern = /^listings\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9._/-]{1,512}$/;
const headerPattern = /^[a-z0-9!#$%&'*+.^_`|~-]+$/;

function invalidUpload() {
  const error = new Error('A autorização de envio da foto é inválida. Tente novamente.');
  error.code = 'invalid_signed_media_upload';
  return error;
}

export function validatedBrowserMediaUpload(signed, file, now = Date.now()) {
  if (!file || !imageTypes.has(file.type) || !Number.isInteger(file.size) ||
      file.size < 1 || file.size > 10_000_000 ||
      !signed || typeof signed !== 'object' || Array.isArray(signed)) {
    throw invalidUpload();
  }
  const {storageKey,uploadUrl,expiresAt,headers} = signed;
  if (typeof storageKey !== 'string' || !keyPattern.test(storageKey) || storageKey.includes('..') ||
      typeof uploadUrl !== 'string' || !uploadUrl || uploadUrl.length > 8192 ||
      uploadUrl.trim() !== uploadUrl || /[\u0000-\u0020\u007f]/.test(uploadUrl)) {
    throw invalidUpload();
  }
  let url;
  try { url = new URL(uploadUrl); } catch { throw invalidUpload(); }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  // URL normalizes decimal/octal IPv4 spellings to dotted addresses.
  // Signed URLs may use DNS names but must not direct selected photos to
  // loopback/private-IP literal endpoints or local DNS names.
  if (url.protocol !== 'https:' || url.username || url.password || url.hash ||
      hostname.startsWith('[') || !hostname.includes('.') ||
      /^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname) ||
      hostname === 'localhost' || hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') || hostname.endsWith('.internal') ||
      hostname.endsWith('.test') && hostname === 'localhost.test') {
    throw invalidUpload();
  }
  const expires = typeof expiresAt === 'string' ? Date.parse(expiresAt) : NaN;
  if (!Number.isFinite(now) || !Number.isFinite(expires) ||
      expires <= now || expires > now + 15 * 60_000) throw invalidUpload();
  if (headers !== undefined && headers !== null &&
      (typeof headers !== 'object' || Array.isArray(headers) ||
       (Object.getPrototypeOf(headers) !== Object.prototype && Object.getPrototypeOf(headers) !== null))) {
    throw invalidUpload();
  }
  const uploadHeaders = {'content-type':file.type};
  const entries = Object.entries(headers ?? {});
  if (entries.length > 32) throw invalidUpload();
  for (const [rawName,value] of entries) {
    const name = rawName.toLowerCase();
    if (!headerPattern.test(name) || forbiddenHeaders.has(name) ||
        typeof value !== 'string' || value.length > 2048 || /[\r\n]/.test(value) ||
        (name === 'content-type' && value !== file.type)) throw invalidUpload();
    uploadHeaders[name] = value;
  }
  return {url:url.toString(),storageKey,headers:uploadHeaders};
}

export async function sendSignedBrowserPhoto(file, signed, fetchImpl = fetch, now = Date.now()) {
  const {url,storageKey,headers} = validatedBrowserMediaUpload(signed,file,now);
  let response;
  try {
    response = await fetchImpl(url,{
      method:'PUT',headers,body:file,
      redirect:'error',credentials:'omit',
    });
  } catch {
    const error = new Error('Não foi possível enviar a foto. Tente novamente.');
    error.code = 'upload_failed';
    throw error;
  }
  if (!response?.ok) {
    const error = new Error('Não foi possível enviar a foto. Tente novamente.');
    error.code = 'upload_failed';
    error.status = Number.isInteger(response?.status) ? response.status : 0;
    throw error;
  }
  return storageKey;
}
