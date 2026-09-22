import { adminSupabase, publicSupabase } from "./supabase";
import { sessionHeaders, checkProfileConfigured } from "./session";
import { clearOAuthStateCookie, hashTxId } from "./oauth-state";

function textEncoder() {
  return new TextEncoder();
}

function bytesToHex(buffer) {
  return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function computeSubjectHash(secret, provider, appId, subject) {
  const keySecret = secret || "etf-campus-default-identity-hmac-salt";
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder().encode(keySecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const data = `${provider}:${appId}:${subject}`;
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder().encode(data));
  return bytesToHex(signature);
}

export function getInternalOAuthEmail(provider, subjectHash, customDomain) {
  const domain = customDomain || "oauth.etfcampus.kr";
  const prefix = subjectHash.slice(0, 32);
  return `${provider}_${prefix}@${domain}`;
}

export async function recordTransaction(env, { txId, provider, origin, returnTo, rememberMe, mode = "login", linkUserId = null }) {
  const admin = adminSupabase(env);
  const txHash = await hashTxId(txId);
  const { data, error } = await admin.rpc("record_oauth_transaction", {
    p_tx_id_hash: txHash,
    p_provider: provider,
    p_origin: origin,
    p_return_to: returnTo,
    p_remember_me: rememberMe !== false,
    p_mode: mode,
    p_link_user_id: linkUserId,
  });

  if (error) {
    console.error("Failed to record OAuth transaction", error);
    throw new Error("OAUTH_TRANSACTION_RECORD_FAILED");
  }
  return data;
}

export async function consumeTransaction(env, txId) {
  const admin = adminSupabase(env);
  const txHash = await hashTxId(txId);
  const { data, error } = await admin.rpc("consume_oauth_transaction", {
    p_tx_id_hash: txHash,
  });

  if (error || !data || (Array.isArray(data) && data.length === 0)) {
    return null;
  }
  return Array.isArray(data) ? data[0] : data;
}

export async function resolveOrCreateOAuthUser(env, { provider, appId, subject }) {
  const admin = adminSupabase(env);
  const subjectHash = await computeSubjectHash(env.OAUTH_IDENTITY_HMAC_SECRET, provider, appId, subject);

  // 1. Resolve existing linked identity
  let { data: existingUserId } = await admin.rpc("resolve_oauth_identity", {
    p_provider: provider,
    p_provider_app_id: appId,
    p_subject_hash: subjectHash,
  });

  // 1-1. Dual-Key Fallback: if not found with current secret, attempt fallback to previous secret
  if (!existingUserId && env.OAUTH_IDENTITY_HMAC_PREVIOUS_SECRET) {
    const prevSubjectHash = await computeSubjectHash(env.OAUTH_IDENTITY_HMAC_PREVIOUS_SECRET, provider, appId, subject);
    const { data: prevUserId } = await admin.rpc("resolve_oauth_identity", {
      p_provider: provider,
      p_provider_app_id: appId,
      p_subject_hash: prevSubjectHash,
    });

    if (prevUserId) {
      existingUserId = prevUserId;
      // Seamless key rotation promotion: link the current subjectHash to the existing user
      try {
        await admin.rpc("link_oauth_identity", {
          p_provider: provider,
          p_provider_app_id: appId,
          p_subject_hash: subjectHash,
          p_user_id: prevUserId,
        });
      } catch (linkPromotionError) {
        console.warn("Failed to auto-promote OAuth identity with rotated secret", linkPromotionError);
      }
    }
  }

  if (existingUserId) {
    const { data: userFetch } = await admin.auth.admin.getUserById(existingUserId);
    if (userFetch?.user?.id && userFetch.user.email) {
      return {
        userId: userFetch.user.id,
        authEmail: userFetch.user.email,
        isNewUser: false,
      };
    }
  }

  // 2. New user provisioning
  const authEmail = getInternalOAuthEmail(provider, subjectHash, env.OAUTH_INTERNAL_EMAIL_DOMAIN);
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: authEmail,
    email_confirm: true,
    app_metadata: {
      auth_bridge: "oauth-v1",
      provider,
    },
  });

  if (createError || !created?.user?.id) {
    // If user already exists in auth.users by email due to concurrent race, fetch by existing
    console.error("User creation failed, checking existing", createError);
    throw new Error("OAUTH_USER_CREATION_FAILED");
  }

  const newUserId = created.user.id;

  // 3. Link identity mapping in DB
  const { error: linkError } = await admin.rpc("link_oauth_identity", {
    p_provider: provider,
    p_provider_app_id: appId,
    p_subject_hash: subjectHash,
    p_user_id: newUserId,
  });

  if (linkError) {
    console.error("Failed to link OAuth identity", linkError);
    throw new Error("OAUTH_IDENTITY_LINK_FAILED");
  }

  return {
    userId: newUserId,
    authEmail,
    isNewUser: true,
  };
}

export async function issueBridgeSession(env, { authEmail, userId }) {
  const admin = adminSupabase(env);

  // 1. Generate magiclink token via Admin REST API
  const linkResult = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: authEmail,
  });

  // REST API returns top-level hashed_token
  const hashedToken = linkResult.data?.hashed_token || linkResult.data?.properties?.hashed_token;
  if (!hashedToken) {
    console.error("No hashed token in generate_link response", linkResult.error);
    throw new Error("OAUTH_BRIDGE_TOKEN_GENERATION_FAILED");
  }

  // 2. Verify magiclink token via Public Client without emailing the user
  const publicClient = publicSupabase(env);
  const verifyResult = await publicClient.auth.verifyOtp({
    email: authEmail,
    token: hashedToken,
    type: "magiclink",
  });

  if (verifyResult.error || !verifyResult.data?.session || !verifyResult.data?.user) {
    console.error("Magiclink verification failed", verifyResult.error);
    throw new Error("OAUTH_BRIDGE_VERIFY_FAILED");
  }

  if (verifyResult.data.user.id !== userId) {
    console.error("User ID mismatch in bridge verification", { expected: userId, actual: verifyResult.data.user.id });
    throw new Error("OAUTH_USER_ID_MISMATCH");
  }

  return verifyResult.data.session;
}

export { checkProfileConfigured };

export function oauthSuccessRedirect(session, destination, rememberMe) {
  const headers = sessionHeaders(session, undefined, rememberMe);
  headers.set("Location", destination);
  headers.set("Referrer-Policy", "no-referrer");
  headers.append("Set-Cookie", clearOAuthStateCookie());

  // Avoid Response.redirect() immutable headers issue
  return new Response(null, {
    status: 302,
    headers,
  });
}
