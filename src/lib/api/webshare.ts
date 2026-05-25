/**
 * Upstream proxy pool wrapper — powers all proxy products.
 * Internal module; the upstream provider is never surfaced to end users.
 */

const BASE = process.env.WEBSHARE_BASE_URL || "https://proxy.webshare.io/api/v2";

/**
 * Residential rotating gateway. Webshare serves rotating residential from a
 * single backbone endpoint (not a proxy list): every request exits from a
 * fresh IP unless pinned to a sticky session via the username.
 */
const RESIDENTIAL_HOST = process.env.WEBSHARE_RESIDENTIAL_HOST || "p.webshare.io";
const RESIDENTIAL_PORT = Number(process.env.WEBSHARE_RESIDENTIAL_PORT) || 80;

/** Mock Gateway toggle — see .env (`USE_MOCK_API`). */
function mockEnabled() {
  return process.env.USE_MOCK_API === "true";
}

function headers() {
  if (!process.env.WEBSHARE_API_KEY) {
    throw new Error("Proxy provider API key is not configured");
  }
  return {
    Authorization: `Token ${process.env.WEBSHARE_API_KEY}`,
    "Content-Type": "application/json"
  };
}

export interface WebshareProxy {
  id: string;
  username: string;
  password: string;
  proxy_address: string;
  port: number;
  country_code: string;
  city_name: string;
  valid: boolean;
  last_verification: string;
}

/** City pool used to geolocate mock proxies. */
const MOCK_CITIES = [
  "Piscataway",
  "Ashburn",
  "Dallas",
  "Los Angeles",
  "Chicago",
  "Atlanta",
  "Seattle",
  "New York",
];

/** A single rotating-gateway credential set — powers rotating residential. */
export interface WebshareGatewayProxy {
  host: string;
  port: number;
  username: string;
  password: string;
  country?: string;
  session?: string;
}

/**
 * Hardcoded proxy allocation that matches the structure of a successful
 * upstream `/proxy/list/` response. Returned when USE_MOCK_API=true so the
 * dashboard + database can be exercised without consuming real credits.
 * Addresses use the TEST-NET-2 documentation range (198.51.100.0/24).
 */
function mockProxies(count: number, country?: string): WebshareProxy[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `mock-${i + 1}`,
    username: `ofs-mock-${Math.random().toString(36).slice(2, 10)}`,
    password: Math.random().toString(36).slice(2, 14),
    proxy_address: `198.51.100.${(i % 254) + 1}`,
    port: 8000 + (i % 1000),
    country_code: country || "US",
    city_name: MOCK_CITIES[i % MOCK_CITIES.length],
    valid: true,
    last_verification: new Date().toISOString()
  }));
}

export const webshare = {
  /**
   * List proxies available for allocation. When USE_MOCK_API=true this
   * returns mock data instead of calling the upstream API.
   */
  async listProxies(params?: {
    country?: string;
    page?: number;
    mode?: "direct" | "backbone";
    count?: number;
  }) {
    const want = Math.max(1, Math.min(500, params?.count ?? 50));

    if (mockEnabled()) {
      const results = mockProxies(want, params?.country);
      return { results, count: results.length };
    }

    const qs = new URLSearchParams();
    if (params?.country) qs.set("country_code__in", params.country);
    if (params?.page) qs.set("page", String(params.page));
    if (params?.mode) qs.set("mode", params.mode);
    qs.set("page_size", String(want));

    const res = await fetch(`${BASE}/proxy/list/?${qs.toString()}`, {
      headers: headers(),
      cache: "no-store"
    });
    if (!res.ok) throw new Error(`Proxy provider request failed: ${res.status}`);
    return res.json() as Promise<{ results: WebshareProxy[]; count: number }>;
  },

  /**
   * Build credentials for the residential rotating gateway — the path for
   * rotating residential proxies. The exit IP rotates on every request;
   * pass a sessionId to pin a sticky IP for that session's lifetime.
   * Country targeting and session pinning are encoded as username modifiers:
   *   <user>[-country-XX][-session-<id>]:<pass>@p.webshare.io:80
   *
   * When USE_MOCK_API=true this returns mock credentials so the dashboard
   * can be exercised without consuming real residential bandwidth.
   */
  buildResidentialGateway(params?: {
    country?: string;
    sessionId?: string;
  }): WebshareGatewayProxy {
    const country = params?.country;
    const sessionId = params?.sessionId;

    const withModifiers = (base: string) => {
      let u = base;
      if (country) u += `-country-${country}`;
      if (sessionId) u += `-session-${sessionId}`;
      return u;
    };

    if (mockEnabled()) {
      return {
        host: RESIDENTIAL_HOST,
        port: RESIDENTIAL_PORT,
        username: withModifiers(`ofs-mock-${Math.random().toString(36).slice(2, 10)}`),
        password: Math.random().toString(36).slice(2, 14),
        country,
        session: sessionId
      };
    }

    const baseUser = process.env.WEBSHARE_RESIDENTIAL_USERNAME;
    const password = process.env.WEBSHARE_RESIDENTIAL_PASSWORD;
    if (!baseUser || !password) {
      throw new Error("Webshare residential gateway credentials are not configured");
    }

    return {
      host: RESIDENTIAL_HOST,
      port: RESIDENTIAL_PORT,
      username: withModifiers(baseUser),
      password,
      country,
      session: sessionId
    };
  },

  /**
   * Account-level usage and bandwidth statistics.
   */
  async getStats() {
    if (mockEnabled()) {
      return { bandwidth_used: 0, bandwidth_limit: 0, mock: true };
    }
    const res = await fetch(`${BASE}/subscription/`, {
      headers: headers(),
      cache: "no-store"
    });
    if (!res.ok) throw new Error(`Proxy provider request failed: ${res.status}`);
    return res.json();
  },

  /**
   * Refresh / rotate proxy credentials.
   */
  async rotateProxy(id: string) {
    if (mockEnabled()) {
      return { id, rotated: true, mock: true };
    }
    const res = await fetch(`${BASE}/proxy/list/refresh/`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ id })
    });
    if (!res.ok) throw new Error(`Proxy provider request failed: ${res.status}`);
    return res.json();
  }
};
