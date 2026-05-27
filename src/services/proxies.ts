/**
 * Higher-level proxy provisioning service.
 * Every proxy type is served by Webshare our sole upstream provider so
 * the rest of the app stays provider-agnostic and the supplier is never
 * exposed to end users.
 */

import { webshare } from "@/lib/api/webshare";
import type { ProxyType } from "@/types";

export interface GenerateInput {
  type: ProxyType;
  country?: string;
  sessionId?: string;
  quantity?: number;
}

export interface GeneratedProxy {
  type: ProxyType;
  host: string;
  port: number;
  username: string;
  password: string;
  country?: string;
  city?: string | null;
  lastChecked?: string | null;
  session?: string;
}

export const proxyService = {
  async generate(input: GenerateInput): Promise<GeneratedProxy[]> {
    const quantity = Math.max(1, Math.min(500, input.quantity ?? 1));

    // Rotating residential is served from Webshare's residential rotating
    // gateway: one sticky session per requested proxy. Each proxy shares the
    // gateway host/port but is pinned to an independent exit IP.
    if (input.type === "rotating_residential") {
      return Array.from({ length: quantity }, () => {
        // Honour a caller-supplied session id for a single proxy; otherwise
        // mint a unique session per proxy so each one rotates independently.
        const sessionId =
          input.sessionId && quantity === 1
            ? input.sessionId
            : `${input.sessionId ? `${input.sessionId}-` : ""}${Math.random()
                .toString(36)
                .slice(2, 10)}`;

        const gw = webshare.buildResidentialGateway({
          country: input.country,
          sessionId
        });

        return {
          type: input.type,
          host: gw.host,
          port: gw.port,
          username: gw.username,
          password: gw.password,
          country: gw.country,
          // Rotating residential is a single gateway endpoint it has no
          // fixed city; the exit IP (and its city) rotates per request.
          city: null,
          lastChecked: new Date().toISOString(),
          session: gw.session
        };
      });
    }

    // Datacenter rides a direct connection; static residential rides the
    // backbone proxy list. Both draw from Webshare's allocated proxy list.
    const mode = input.type === "datacenter" ? "direct" : "backbone";

    const list = await webshare.listProxies({
      country: input.country,
      mode,
      count: quantity
    });

    return list.results.slice(0, quantity).map((p) => ({
      type: input.type,
      host: p.proxy_address,
      port: p.port,
      username: p.username,
      password: p.password,
      country: p.country_code,
      city: p.city_name ?? null,
      lastChecked: p.last_verification ?? new Date().toISOString(),
      session: input.sessionId
    }));
  }
};
