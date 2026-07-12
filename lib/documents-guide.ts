/**
 * How to actually obtain each document.
 *
 * Telling a citizen "you need an income certificate" and stopping there is the
 * same failure the whole app exists to fix. This maps our DigiLocker document
 * types to plain-language guidance: who issues it, where to apply, and roughly
 * how long it takes.
 *
 * Keyed by RequiredDocument.digilockerDocType.
 */

export interface DocGuide {
  /** Who issues it. */
  issuer: string;
  /** Where/how to apply, in plain language. */
  howTo: string;
  /** Typical turnaround. */
  timeline?: string;
  /** Official portal, when there's a national one. */
  url?: string;
}

export const DOC_GUIDES: Record<string, DocGuide> = {
  AADHAAR: {
    issuer: "UIDAI",
    howTo:
      "Visit any Aadhaar Enrolment Centre with proof of identity and address. Enrolment is free.",
    timeline: "Usually 15–30 days by post",
    url: "https://uidai.gov.in/",
  },
  INCOME_CERTIFICATE: {
    issuer: "State Revenue Department (Tehsildar / SDM)",
    howTo:
      "Apply at your Tehsil office or your state's e-District portal with an ID, address proof, and a salary slip or self-declaration of income.",
    timeline: "Typically 7–21 days",
    url: "https://services.india.gov.in/",
  },
  CASTE_CERTIFICATE: {
    issuer: "State Revenue Department (Tehsildar / SDM)",
    howTo:
      "Apply at your Tehsil office or state e-District portal with proof of your family's caste (a parent's certificate or an old school record) and address proof.",
    timeline: "Typically 15–30 days",
    url: "https://services.india.gov.in/",
  },
  DOMICILE_CERTIFICATE: {
    issuer: "State Revenue Department",
    howTo:
      "Apply at your Tehsil office or state e-District portal with proof you've lived in the state (ration card, voter ID, school records).",
    timeline: "Typically 7–21 days",
  },
  RATION_CARD: {
    issuer: "State Food & Civil Supplies Department",
    howTo:
      "Apply at your local Food & Civil Supplies office or your state's PDS portal with Aadhaar and address proof for all family members.",
    timeline: "Typically 15–30 days",
  },
  BANK_PASSBOOK: {
    issuer: "Any bank",
    howTo:
      "Open a zero-balance Jan Dhan account at any bank branch or Post Office with just your Aadhaar. Ask for the passbook.",
    timeline: "Same day",
    url: "https://pmjdy.gov.in/",
  },
  UDID: {
    issuer: "State Disability Commissioner / District Hospital",
    howTo:
      "Apply on the UDID portal, then attend the medical assessment at your district hospital. This also serves as your disability certificate.",
    timeline: "Typically 30–60 days",
    url: "https://swavlambancard.gov.in/",
  },
  LAND_RECORD: {
    issuer: "State Revenue Department (Patwari / Tehsildar)",
    howTo:
      "Get your Record of Rights (RoR / 7-12 / Khatauni) from the Patwari or your state's land-records portal.",
    timeline: "Typically 1–7 days",
    url: "https://dilrmp.gov.in/",
  },
};

export function getDocGuide(docType: string | null): DocGuide | null {
  if (!docType) return null;
  return DOC_GUIDES[docType] ?? null;
}
