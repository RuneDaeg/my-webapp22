import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { AiError } from "./types";

// [보안] 교사 API 키는 DB에 평문으로 두지 않는다. 복호화 키(AI_KEY_ENCRYPTION_SECRET)는 DB가 아니라
// 서버 환경변수에 두어, Supabase 접근 권한(대시보드/덤프/service_role 키)만으로는 키를 못 읽게 한다.
// 한계: 서버 환경변수까지 접근 가능한 사람(배포 소유자)은 여전히 복호화할 수 있다 — API 키 방식의
// 구조적 한계이며, 목적은 "at-rest 노출 차단 + 신뢰 영역 분리"다.

// 저장 포맷: "v1:<iv>:<authTag>:<ciphertext>" (각 구간 base64 — ':'는 base64 문자가 아니라 분리 안전)
const VERSION = "v1";

export class EncryptionKeyMissingError extends AiError {}

function masterKey(): Buffer {
  const secret = process.env.AI_KEY_ENCRYPTION_SECRET;
  if (!secret) {
    throw new EncryptionKeyMissingError(
      "서버에 AI_KEY_ENCRYPTION_SECRET이 설정되지 않아 API 키를 안전하게 저장할 수 없습니다.",
    );
  }
  // 고엔트로피 랜덤 시크릿을 AES-256용 32바이트로 정규화한다.
  return createHash("sha256").update(secret, "utf8").digest();
}

// 0015 마이그레이션 시절 평문으로 저장된 값과 구분한다.
export function isEncrypted(stored: string): boolean {
  return stored.startsWith(`${VERSION}:`);
}

export function encryptApiKey(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", masterKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [
    VERSION,
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

// 평문(구버전 저장분)이 들어오면 그대로 돌려준다 — 호출부가 이를 감지해 재암호화한다.
export function decryptApiKey(stored: string): string {
  if (!isEncrypted(stored)) return stored;

  const [, ivB64, tagB64, ciphertextB64] = stored.split(":");
  if (!ivB64 || !tagB64 || !ciphertextB64) {
    throw new AiError("저장된 API 키 형식이 올바르지 않습니다. 계정 설정에서 키를 다시 등록해주세요.");
  }

  try {
    const decipher = createDecipheriv("aes-256-gcm", masterKey(), Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextB64, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch (err) {
    if (err instanceof EncryptionKeyMissingError) throw err;
    // 인증 태그 불일치 = 시크릿이 바뀌었거나 데이터가 변조됨. 복호화는 불가능하니 재등록만이 답.
    throw new AiError(
      "저장된 API 키를 복호화할 수 없습니다. 계정 설정에서 키를 다시 등록해주세요.",
    );
  }
}
