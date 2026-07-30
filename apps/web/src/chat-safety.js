const PHONE_DIGIT_PATTERN = /(?:\+?55\s*)?(?:\(?\d{2}\)?[\s.-]*)?(?:9?[\s.-]*\d[\s.-]*){7,8}/;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const URL_PATTERN = /(?:https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|com\.br|net|org|io|app|me|co|ly)\b)/i;
const SOCIAL_PATTERN = /(?:instagram|insta(?:gram)?|facebook|fb\.com|arroba|@[a-z0-9._]{2,})/i;
const QR_PATTERN = /(?:q\s*r\s*code|qrcode|c[oó]digo\s*q\s*r)/i;
const NUMBER_WORDS = new Set([
  "zero", "um", "uma", "dois", "duas", "tres", "quatro",
  "cinco", "seis", "sete", "oito", "nove", "dez"
]);

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function containsWrittenPhone(value) {
  const words = normalize(value).match(/[a-z]+/g) || [];
  let sequence = 0;
  let maxSequence = 0;

  for (const word of words) {
    if (NUMBER_WORDS.has(word)) {
      sequence += 1;
      maxSequence = Math.max(maxSequence, sequence);
    } else if (!["e", "meia"].includes(word)) {
      sequence = 0;
    }
  }

  return maxSequence >= 7;
}

export function blockedContactReason(value) {
  const text = String(value || "").trim();
  if (!text) return "";

  if (EMAIL_PATTERN.test(text)) return "Não envie e-mail no chat.";
  if (URL_PATTERN.test(text)) return "Links não são permitidos no chat.";
  if (SOCIAL_PATTERN.test(text)) return "Perfis de Instagram ou Facebook não são permitidos.";
  if (QR_PATTERN.test(text)) return "QR codes não são permitidos no chat.";
  if (PHONE_DIGIT_PATTERN.test(text) || containsWrittenPhone(text)) {
    return "Números de telefone, inclusive escritos por extenso, não são permitidos.";
  }

  return "";
}
