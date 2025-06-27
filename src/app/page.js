"use client";
import { useEffect, useRef } from "react";

export default function Home() {
  const listenerRef = useRef(null);
  const tokensRef = useRef(null);

  useEffect(() => {
    acquireEmbedTokens();
    listenerRef.current = window.addEventListener("message", (event) => {
      let { data } = event;
      if (event.origin === process.env.NEXT_PUBLIC_LOOKER_URL) {
        data = JSON.parse(data);
        if (data.type === "session:tokens:request") {
          generateEmbedTokens(event.source, event.origin);
        }
      }
    });

    return () => {
      // cleanup listener
      window.removeEventListener("message", listenerRef.current);
    };
  }, []);

  const generateEmbedTokens = async (source, origin) => {
    const response = await fetch("/api/generate-embed-tokens", {
      method: "POST",
    });
    const data = await response.json();
    source.postMessage(
      JSON.stringify({
        type: "session:tokens",
        ...data,
      }),
      origin
    );
  };

  const acquireEmbedTokens = async () => {
    const response = await fetch("/api/acquire-embed-session", {
      method: "POST",
    });
    const data = await response.json();
    tokensRef.current = data;
    const path = `/embed/dashboards/1`;
    const query_params = {
      embed_domain: location.origin,
      embed_navigation_token: data.navigation_token,
    };
    const encoded_path = encodeURIComponent(
      path +
        "?" +
        Object.entries(query_params)
          .map(([key, value]) => `${key}=${value}`)
          .join("&")
    );

    const iframe_url = new URL(
      `${process.env.NEXT_PUBLIC_LOOKER_URL}/login/embed/${encoded_path}`
    );
    iframe_url.searchParams.set(
      "embed_authentication_token",
      data.authentication_token
    );
    const looker_iframe = document.getElementById("looker-iframe");
    looker_iframe.src = iframe_url.toString();
  };

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <iframe id="looker-iframe" style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
