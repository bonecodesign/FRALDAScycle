export const DEFAULT_LOCAL_API_ORIGIN = 'http://127.0.0.1:4200';
export function approvedLocalApiOrigin(value = DEFAULT_LOCAL_API_ORIGIN) {
  const url = new URL(value);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
    || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new TypeError('SURFACE_API_ORIGIN local deve ser uma origem HTTP de loopback sem credenciais, caminho ou parâmetros.');
  }
  return url.origin;
}
