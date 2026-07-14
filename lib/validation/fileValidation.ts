export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB
export const ALLOWED_EXTENSIONS = ["pdf", "docx", "hwpx", "txt"] as const;

export class FileValidationError extends Error {}

export function validateUploadedFile(file: File): void {
  if (file.size === 0) {
    throw new FileValidationError("빈 파일은 업로드할 수 없습니다.");
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new FileValidationError("파일 크기는 20MB를 초과할 수 없습니다.");
  }

  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  if (ext === "hwp") {
    throw new FileValidationError(
      "이 앱은 .hwp가 아닌 .hwpx만 지원합니다. 한글에서 '다른 이름으로 저장' → HWPX로 저장한 뒤 다시 업로드해주세요.",
    );
  }
  if (!ALLOWED_EXTENSIONS.includes(ext as (typeof ALLOWED_EXTENSIONS)[number])) {
    throw new FileValidationError(
      `지원하지 않는 파일 형식입니다: .${ext || "알 수 없음"}. pdf/docx/hwpx/txt만 업로드할 수 있습니다.`,
    );
  }
}

// Supabase Storage는 오브젝트 키(경로)에 한글 등 비-ASCII 문자를 허용하지 않는다
// (StorageApiError: Invalid key). 원본 파일명은 DB의 original_filename 컬럼에 그대로
// 저장해 화면에는 한글로 보여주고, 실제 저장 경로는 항상 ASCII로만 구성한다.
export function sanitizeFilename(name: string): string {
  const sanitized = name.replace(/[^\w.-]/g, "_").replace(/_{2,}/g, "_");
  const ext = sanitized.includes(".") ? sanitized.split(".").pop() : "";
  const isDegenerate = !sanitized || /^_*(\.[^.]*)?$/.test(sanitized);
  return isDegenerate ? `file_${Date.now()}${ext ? `.${ext}` : ""}` : sanitized;
}
