export async function onRequestPost(context) {
  const cookie = `__Host-etf_admin_session=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0`;
  return new Response(JSON.stringify({ success: true }), {
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": cookie
    }
  });
}
