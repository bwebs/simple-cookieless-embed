import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getCache, setCache } from "../acquire-embed-session/route";

export async function POST() {
  const userAgent = (await headers()).get("user-agent");
  let admin_access_token = await getCache("admin_access_token");
  if (!admin_access_token) {
    const query = new URLSearchParams({
      client_id: process.env.LOOKERSDK_CLIENT_ID,
      client_secret: process.env.LOOKERSDK_CLIENT_SECRET,
    });
    admin_access_token = await fetch(
      `${process.env.LOOKERSDK_BASE_URL}/api/4.0/login?${query.toString()}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    )
      .then((response) => {
        return response.json();
      })
      .catch((error) => {
        console.error(error);
        return null;
      });
    setCache("admin_access_token", admin_access_token, 3600);
  }
  const external_user_id = "embed_user_123";
  const cacheKey = `${userAgent}-${external_user_id}`;
  const tokens = await getCache(cacheKey);
  if (!tokens) {
    return NextResponse.json(
      { message: "Failed to get embed session reference token" },
      { status: 500 }
    );
  }

  const all = await fetch(
    `${process.env.LOOKERSDK_BASE_URL}/api/4.0/embed/cookieless_session/generate_tokens`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${admin_access_token.access_token}`,
        "User-Agent": userAgent,
      },
      body: JSON.stringify(tokens),
    }
  ).then((response) => {
    return response.json();
  });
  const { session_reference_token, ...client_tokens } = all;

  return NextResponse.json({
    ...client_tokens,
    navigation_token_ttl: 10,
    api_token_ttl: 10,
  });
}
