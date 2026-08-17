export type AuthUser = {
  id: string;
  email: string;
  displayName: string | null;
};

export type SessionResponse = {
  authenticated: boolean;
  user?: AuthUser;
  expiresAt?: number;
};

type ApiError = Error & { status?: number; code?: string };

async function readResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (response.ok) return payload as T;

  const error = new Error(payload.error ?? "요청을 처리하지 못했습니다.") as ApiError;
  error.status = response.status;
  error.code = payload.error;
  throw error;
}

export async function authRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: {
      accept: "application/json",
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });
  return readResponse<T>(response);
}

export async function getSession(): Promise<SessionResponse> {
  return authRequest<SessionResponse>("/api/auth/session", { method: "GET" });
}

export async function login(input: { email: string; password: string }) {
  return authRequest<{ user: AuthUser; expiresAt: number }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function register(input: {
  email: string;
  password: string;
  displayName?: string;
  requiredConsent: boolean;
  marketingConsent: boolean;
}) {
  return authRequest<{ user: AuthUser; expiresAt: number }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function logout() {
  return authRequest<void>("/api/auth/logout", { method: "POST" });
}

export async function requestPasswordReset(email: string) {
  return authRequest<{ message: string }>("/api/auth/password-reset-request", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(input: {
  token: string;
  newPassword: string;
  confirmPassword: string;
}) {
  return authRequest<{ message: string }>("/api/auth/password-reset", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function authErrorMessage(error: unknown, fallback = "잠시 후 다시 시도해 주세요.") {
  const code = (error as ApiError)?.code;
  const messages: Record<string, string> = {
    invalid_credentials: "이메일 또는 비밀번호를 다시 확인해 주세요.",
    email_already_registered: "이미 가입된 이메일입니다. 로그인해 주세요.",
    invalid_email: "올바른 이메일 주소를 입력해 주세요.",
    invalid_password: "비밀번호는 10자 이상 128자 이하로 입력해 주세요.",
    required_consent_missing: "서비스 이용약관과 개인정보 처리방침 동의가 필요합니다.",
    invalid_or_expired_token: "재설정 링크가 유효하지 않거나 만료되었습니다.",
    password_reset_unavailable: "재설정 메일을 발송하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    service_unavailable: "인증 서비스를 준비 중입니다. 잠시 후 다시 시도해 주세요.",
  };
  return messages[code ?? ""] ?? fallback;
}
