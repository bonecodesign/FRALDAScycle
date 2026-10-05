export const CONTENT_RULE_VERSION = 'FC-CONTENT-1';
function normalize(value) {
  return value.normalize('NFKC').normalize('NFD').replace(/\p{M}|\p{Cf}/gu, '').toLowerCase();
}
const NUMBER_WORDS = { zero:'0',um:'1',uma:'1',dois:'2',duas:'2',tres:'3',quatro:'4',cinco:'5',seis:'6',sete:'7',oito:'8',nove:'9',dez:'10',onze:'11',doze:'12',treze:'13',quatorze:'14',catorze:'14',quinze:'15',dezesseis:'16',dezessete:'17',dezoito:'18',dezenove:'19',vinte:'20',trinta:'30',quarenta:'40',cinquenta:'50',sessenta:'60',setenta:'70',oitenta:'80',noventa:'90' };
export function detectProhibitedContent(value, { chat = false, review = false } = {}) {
  const text = normalize(String(value));
  const reasons = [];
  const email = text.replace(/\s*(?:\[\s*arroba\s*\]|\(\s*arroba\s*\)|\barroba\b|\(\s*@\s*\)|\[\s*@\s*\])\s*/g, '@')
    .replace(/\s*(?:\[\s*ponto\s*\]|\(\s*ponto\s*\)|\bponto\b)\s*/g, '.').replace(/\s*@\s*/g, '@').replace(/\s*\.\s*/g, '.');
  if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(email)) reasons.push('email');
  let numbers = text.replace(/\b(trinta|quarenta|cinquenta|sessenta|setenta|oitenta|noventa|vinte)\s+e\s+(um|dois|tres|quatro|cinco|seis|sete|oito|nove)\b/g,
    (_, tens, units) => String(Number(NUMBER_WORDS[tens]) + Number(NUMBER_WORDS[units])));
  numbers = numbers.replace(/\b[a-z]+\b/g, word => NUMBER_WORDS[word] ?? word);
  if (/(?<!\d)(?:\d[^\p{L}\p{N}]{0,5}){8,15}(?!\d)/u.test(numbers)) reasons.push('phone');
  if (/(?:https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|net|org|io|app|me|link)\b)/i.test(email)) reasons.push('external_link');
  if (/\b(?:whats\s*app|whats|zap|telegram|instagram|insta|facebook|pix\s+direto|pagar\s+(?:por\s+)?fora|negociar\s+fora|me\s+liga|chama\s+no)\b|@[a-z0-9._]{3,}/i.test(text)) reasons.push('external_contact');
  if (chat && /\b(?:qr\s*code|qrcode|codigo\s*qr)\b/.test(text)) reasons.push('qr_code');
  if (chat && /\b(?:contraproposta|fechar\s+por|abaixar\s+preco|pagar\s+por\s+fora)\b/.test(text)) reasons.push('chat_conditions');
  if (review && /\b(?:rua|avenida|travessa|logradouro|cep)\s+[^\s]|\b(?:data\s+de\s+nascimento|nome\s+do\s+bebe|comprovante\s+de\s+entrega|conteudo\s+do\s+chat)\b/.test(text)) reasons.push('private_review_content');
  return [...new Set(reasons)];
}
