/**
 * DigiLocker provider abstraction.
 *
 * Real DigiLocker access is gated behind partner/requester registration and
 * OAuth 2.0 (Meripehchaan). For local development we use a mock provider that
 * returns a realistic set of "issued" documents, so the have/need document
 * matching and the whole connect flow are fully testable without credentials.
 */

export interface IssuedDocument {
  docType: string; // normalized, matches RequiredDocument.digilockerDocType
  name: string;
  issuer?: string;
  uri?: string;
  issuedAt?: Date;
}

export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}

export interface DigiLockerProvider {
  readonly isMock: boolean;
  /** Where to send the user to authorize. */
  getAuthorizeUrl(state: string): string;
  /** Exchange an OAuth code for tokens. */
  exchangeCode(code: string): Promise<TokenSet>;
  /** Fetch the list of issued documents for an authorized user. */
  fetchIssuedDocuments(tokens: TokenSet): Promise<IssuedDocument[]>;
}

// --- Mock provider (development) ---------------------------------------------

const MOCK_DOCS: IssuedDocument[] = [
  { docType: "AADHAAR", name: "Aadhaar Card", issuer: "UIDAI" },
  { docType: "BANK_PASSBOOK", name: "Bank Passbook", issuer: "State Bank of India" },
  { docType: "RATION_CARD", name: "Ration Card", issuer: "Dept. of Food & Civil Supplies" },
  { docType: "INCOME_CERTIFICATE", name: "Income Certificate", issuer: "Revenue Dept." },
];

class MockDigiLockerProvider implements DigiLockerProvider {
  readonly isMock = true;

  getAuthorizeUrl(state: string): string {
    // Skip the real OAuth round-trip: bounce straight to our callback with a
    // fake code so the flow is exercised end-to-end.
    const redirect =
      process.env.DIGILOCKER_REDIRECT_URI ??
      "http://localhost:3000/api/digilocker/callback";
    const url = new URL(redirect);
    url.searchParams.set("code", "mock-code");
    url.searchParams.set("state", state);
    return url.toString();
  }

  async exchangeCode(): Promise<TokenSet> {
    return {
      accessToken: "mock-access-token",
      expiresAt: new Date(Date.now() + 3600_000),
    };
  }

  async fetchIssuedDocuments(): Promise<IssuedDocument[]> {
    return MOCK_DOCS.map((d) => ({ ...d, issuedAt: new Date() }));
  }
}

// --- Real provider (stub; wired for when credentials exist) ------------------

const DIGILOCKER_BASE = "https://api.digitallocker.gov.in";

class RealDigiLockerProvider implements DigiLockerProvider {
  readonly isMock = false;

  constructor(
    private clientId: string,
    private clientSecret: string,
    private redirectUri: string,
  ) {}

  getAuthorizeUrl(state: string): string {
    const url = new URL(`${DIGILOCKER_BASE}/public/oauth2/1/authorize`);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", this.clientId);
    url.searchParams.set("redirect_uri", this.redirectUri);
    url.searchParams.set("state", state);
    return url.toString();
  }

  async exchangeCode(code: string): Promise<TokenSet> {
    const res = await fetch(`${DIGILOCKER_BASE}/public/oauth2/1/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
      }),
    });
    if (!res.ok) throw new Error(`DigiLocker token exchange failed: ${res.status}`);
    const data = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined,
    };
  }

  async fetchIssuedDocuments(tokens: TokenSet): Promise<IssuedDocument[]> {
    const res = await fetch(`${DIGILOCKER_BASE}/public/oauth2/2/files/issued`, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
    if (!res.ok) throw new Error(`DigiLocker issued-docs failed: ${res.status}`);
    const data = (await res.json()) as {
      items?: { doctype?: string; name?: string; issuer?: string; uri?: string }[];
    };
    return (data.items ?? []).map((d) => ({
      docType: (d.doctype ?? "UNKNOWN").toUpperCase(),
      name: d.name ?? d.doctype ?? "Document",
      issuer: d.issuer,
      uri: d.uri,
    }));
  }
}

export function getDigiLockerProvider(): DigiLockerProvider {
  const useMock =
    process.env.DIGILOCKER_USE_MOCK === "true" ||
    !process.env.DIGILOCKER_CLIENT_ID ||
    !process.env.DIGILOCKER_CLIENT_SECRET;

  if (useMock) return new MockDigiLockerProvider();

  return new RealDigiLockerProvider(
    process.env.DIGILOCKER_CLIENT_ID!,
    process.env.DIGILOCKER_CLIENT_SECRET!,
    process.env.DIGILOCKER_REDIRECT_URI ??
      "http://localhost:3000/api/digilocker/callback",
  );
}
