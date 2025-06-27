import { promises as fs } from "fs";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import path from "path";

const CACHE_FILE = path.join(process.cwd(), "tmp.json");

export async function getCache(key) {
  try {
    const data = await fs.readFile(CACHE_FILE, "utf8");
    const cache = JSON.parse(data);
    const value = cache[key];

    if (!value) {
      console.error("Cache not found", key);
      return;
    } else {
      if (value[1] > Date.now()) {
        return value[0];
      } else {
        console.error("Cache expired", key);
        return;
      }
    }
  } catch (error) {
    if (error.code === "ENOENT") {
      console.log("Cache file not found, creating new one");
      return;
    }
    console.error("Error reading cache:", error);
    return;
  }
}

export async function setCache(key, value, ttl) {
  try {
    let cache = {};
    try {
      const data = await fs.readFile(CACHE_FILE, "utf8");
      cache = JSON.parse(data);
    } catch (error) {
      if (error.code !== "ENOENT") {
        console.error("Error reading existing cache:", error);
      }
    }

    cache[key] = [value, Date.now() + ttl * 1000];

    await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch (error) {
    console.error("Error writing cache:", error);
  }
}

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
    ).then((response) => {
      return response.json();
    });
    await setCache("admin_access_token", admin_access_token, 3600);
  }
  if (!admin_access_token) {
    return NextResponse.json(
      { message: "Failed to get admin access token" },
      { status: 500 }
    );
  }

  const external_user_id = "embed_user_123";
  const cacheKey = `${userAgent}-${external_user_id}`;

  const cachedTokens = await getCache(cacheKey);

  const embed_config = {
    session_length: 3600,
    force_logout_login: true,
    external_user_id,
    first_name: "Cookieless-Embed",
    last_name: "User",
    permissions: ["access_data", "see_user_dashboards"],
    models: ["az_load_test"],
    user_attributes: { stored_id: "1" },
    session_reference_token: cachedTokens
      ? cachedTokens.session_reference_token
      : undefined,
  };

  const acquire = await fetch(
    `${process.env.LOOKERSDK_BASE_URL}/api/4.0/embed/cookieless_session/acquire`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${admin_access_token.access_token}`,
        "User-Agent": userAgent,
      },
      body: JSON.stringify(embed_config),
    }
  ).then((response) => response.json());

  const { session_reference_token, ...client_tokens } = acquire;

  await setCache(cacheKey, { session_reference_token, ...client_tokens }, 3600);

  return NextResponse.json(client_tokens);
}
