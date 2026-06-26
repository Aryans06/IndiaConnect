/**
 * Hand-curated, verified dataset of widely-used central government schemes.
 * Rules use the canonical attribute keys (lib/eligibility/attributes.ts) and
 * operators (lib/eligibility/rules.ts). This is the fallback seed that
 * guarantees IndiaConnect works fully even if the myScheme scrape is
 * unavailable — and it's the data the eligibility engine is tested against.
 *
 * Eligibility rules here are simplified to the core, machine-checkable criteria
 * a citizen can self-report. They are NOT a substitute for the official
 * eligibility text; each scheme links to its source for authoritative detail.
 */
import type { RuleOperator } from "@/lib/eligibility/rules";
import type { RuleValue } from "@/lib/eligibility/rules";

export interface CuratedRule {
  attribute: string;
  operator: RuleOperator;
  value: RuleValue;
  orGroup?: string;
  rawText?: string;
}

export interface CuratedScheme {
  slug: string;
  title: string;
  ministry?: string;
  category: string;
  level: "CENTRAL" | "STATE";
  state?: string | null;
  summary: string;
  benefits?: string;
  howToApply?: string;
  sourceUrl?: string;
  rules: CuratedRule[];
  documents: { name: string; digilockerDocType?: string }[];
  steps: string[];
}

// Common DigiLocker-mappable document types reused across schemes.
const DOC = {
  aadhaar: { name: "Aadhaar Card", digilockerDocType: "AADHAAR" },
  income: { name: "Income Certificate", digilockerDocType: "INCOME_CERTIFICATE" },
  caste: { name: "Caste Certificate", digilockerDocType: "CASTE_CERTIFICATE" },
  domicile: { name: "Domicile Certificate", digilockerDocType: "DOMICILE_CERTIFICATE" },
  bank: { name: "Bank Passbook", digilockerDocType: "BANK_PASSBOOK" },
  ration: { name: "Ration Card", digilockerDocType: "RATION_CARD" },
  disability: { name: "Disability Certificate (UDID)", digilockerDocType: "UDID" },
  land: { name: "Land Records", digilockerDocType: "LAND_RECORD" },
  photo: { name: "Passport-size Photograph" },
} as const;

export const CURATED_SCHEMES: CuratedScheme[] = [
  {
    slug: "pm-kisan",
    title: "Pradhan Mantri Kisan Samman Nidhi (PM-KISAN)",
    ministry: "Ministry of Agriculture & Farmers Welfare",
    category: "Agriculture",
    level: "CENTRAL",
    summary:
      "Income support of ₹6,000 per year, in three equal instalments, to all landholding farmer families.",
    benefits: "₹6,000/year paid directly to your bank account (DBT).",
    sourceUrl: "https://pmkisan.gov.in/",
    rules: [
      { attribute: "occupation", operator: "EQ", value: "farmer", rawText: "Landholding farmer family" },
    ],
    documents: [DOC.aadhaar, DOC.land, DOC.bank],
    steps: [
      "Register at pmkisan.gov.in or your nearest Common Service Centre (CSC).",
      "Provide Aadhaar, land records and bank account details.",
      "Verification by the local revenue/agriculture officer.",
    ],
  },
  {
    slug: "ayushman-bharat-pmjay",
    title: "Ayushman Bharat – PM Jan Arogya Yojana (PM-JAY)",
    ministry: "Ministry of Health & Family Welfare",
    category: "Health",
    level: "CENTRAL",
    summary:
      "Health cover of ₹5 lakh per family per year for secondary and tertiary care hospitalisation, for poor and vulnerable families.",
    benefits: "Cashless hospitalisation up to ₹5,00,000 per family per year.",
    sourceUrl: "https://pmjay.gov.in/",
    rules: [
      { attribute: "rationCardType", operator: "IN", value: ["BPL", "AAY"], rawText: "Deprived / SECC-listed households" },
    ],
    documents: [DOC.aadhaar, DOC.ration],
    steps: [
      "Check eligibility on pmjay.gov.in or call 14555.",
      "Visit any empanelled hospital with your Aadhaar.",
      "Get your Ayushman card generated and avail cashless treatment.",
    ],
  },
  {
    slug: "ignoaps",
    title: "Indira Gandhi National Old Age Pension Scheme (IGNOAPS)",
    ministry: "Ministry of Rural Development",
    category: "Social Welfare",
    level: "CENTRAL",
    summary:
      "Monthly pension for elderly citizens aged 60 and above belonging to below-poverty-line families.",
    benefits: "₹200–₹500/month pension (higher for those 80+), via the state.",
    sourceUrl: "https://nsap.nic.in/",
    rules: [
      { attribute: "age", operator: "GTE", value: 60 },
      { attribute: "rationCardType", operator: "IN", value: ["BPL", "AAY"] },
    ],
    documents: [DOC.aadhaar, DOC.ration, DOC.bank],
    steps: [
      "Apply via your Gram Panchayat / municipality or the NSAP portal.",
      "Submit age proof, BPL proof and bank details.",
    ],
  },
  {
    slug: "ignwps",
    title: "Indira Gandhi National Widow Pension Scheme (IGNWPS)",
    ministry: "Ministry of Rural Development",
    category: "Social Welfare",
    level: "CENTRAL",
    summary:
      "Monthly pension for widows aged 40–79 from below-poverty-line families.",
    benefits: "₹300+/month pension via the state government.",
    sourceUrl: "https://nsap.nic.in/",
    rules: [
      { attribute: "gender", operator: "EQ", value: "female" },
      { attribute: "age", operator: "BETWEEN", value: [40, 79] },
      { attribute: "rationCardType", operator: "IN", value: ["BPL", "AAY"] },
    ],
    documents: [DOC.aadhaar, DOC.ration, DOC.bank],
    steps: [
      "Apply through your Gram Panchayat / municipality.",
      "Submit widowhood proof, age proof and BPL proof.",
    ],
  },
  {
    slug: "igndps",
    title: "Indira Gandhi National Disability Pension Scheme (IGNDPS)",
    ministry: "Ministry of Rural Development",
    category: "Social Welfare",
    level: "CENTRAL",
    summary:
      "Monthly pension for persons with severe or multiple disabilities aged 18–79 from below-poverty-line families.",
    benefits: "₹300+/month pension via the state government.",
    sourceUrl: "https://nsap.nic.in/",
    rules: [
      { attribute: "isDisabled", operator: "EQ", value: true },
      { attribute: "age", operator: "BETWEEN", value: [18, 79] },
      { attribute: "rationCardType", operator: "IN", value: ["BPL", "AAY"] },
    ],
    documents: [DOC.aadhaar, DOC.disability, DOC.ration, DOC.bank],
    steps: [
      "Apply through your Gram Panchayat / municipality or NSAP portal.",
      "Submit disability certificate (UDID), age and BPL proof.",
    ],
  },
  {
    slug: "pmay-gramin",
    title: "Pradhan Mantri Awas Yojana – Gramin (PMAY-G)",
    ministry: "Ministry of Rural Development",
    category: "Housing",
    level: "CENTRAL",
    summary:
      "Financial assistance to build a pucca house for houseless and BPL households in rural areas.",
    benefits: "₹1.2–1.3 lakh assistance to construct a pucca house.",
    sourceUrl: "https://pmayg.nic.in/",
    rules: [
      { attribute: "rationCardType", operator: "IN", value: ["BPL", "AAY"] },
    ],
    documents: [DOC.aadhaar, DOC.ration, DOC.bank],
    steps: [
      "Eligibility is drawn from the SECC list; verify at pmayg.nic.in.",
      "Aadhaar and bank account seeding done via Gram Panchayat.",
    ],
  },
  {
    slug: "pm-ujjwala",
    title: "Pradhan Mantri Ujjwala Yojana (PMUY)",
    ministry: "Ministry of Petroleum & Natural Gas",
    category: "Social Welfare",
    level: "CENTRAL",
    summary:
      "Free LPG connection to women from poor households to reduce reliance on traditional cooking fuels.",
    benefits: "Free LPG connection + deposit-free first refill and stove.",
    sourceUrl: "https://www.pmuy.gov.in/",
    rules: [
      { attribute: "gender", operator: "EQ", value: "female" },
      { attribute: "rationCardType", operator: "IN", value: ["BPL", "AAY"] },
    ],
    documents: [DOC.aadhaar, DOC.ration, DOC.bank, DOC.photo],
    steps: [
      "Apply at your nearest LPG distributor or pmuy.gov.in.",
      "Submit Aadhaar, BPL ration card and bank details.",
    ],
  },
  {
    slug: "sukanya-samriddhi",
    title: "Sukanya Samriddhi Yojana (SSY)",
    ministry: "Ministry of Finance",
    category: "Women & Child",
    level: "CENTRAL",
    summary:
      "A small-savings scheme for the girl child, opened before she turns 10, offering high tax-free interest.",
    benefits: "High guaranteed interest, tax-free, to fund her education/marriage.",
    sourceUrl: "https://www.india.gov.in/spotlight/sukanya-samriddhi-yojana",
    rules: [
      { attribute: "gender", operator: "EQ", value: "female" },
      { attribute: "age", operator: "LTE", value: 10 },
    ],
    documents: [DOC.aadhaar, DOC.photo],
    steps: [
      "Open an SSY account at any post office or authorised bank.",
      "Provide the girl's birth certificate and guardian's KYC.",
    ],
  },
  {
    slug: "post-matric-scholarship-sc",
    title: "Post-Matric Scholarship for SC Students",
    ministry: "Ministry of Social Justice & Empowerment",
    category: "Education",
    level: "CENTRAL",
    summary:
      "Financial assistance to Scheduled Caste students pursuing post-matriculation (Class 11 and above) studies.",
    benefits: "Maintenance allowance + reimbursement of fees.",
    sourceUrl: "https://scholarships.gov.in/",
    rules: [
      { attribute: "occupation", operator: "EQ", value: "student" },
      { attribute: "socialCategory", operator: "EQ", value: "SC" },
      { attribute: "annualIncome", operator: "LTE", value: 250000 },
    ],
    documents: [DOC.aadhaar, DOC.caste, DOC.income, DOC.bank],
    steps: [
      "Register on the National Scholarship Portal (scholarships.gov.in).",
      "Upload caste certificate, income certificate and admission proof.",
    ],
  },
  {
    slug: "post-matric-scholarship-obc",
    title: "Post-Matric Scholarship for OBC Students",
    ministry: "Ministry of Social Justice & Empowerment",
    category: "Education",
    level: "CENTRAL",
    summary:
      "Financial assistance to Other Backward Class students pursuing post-matriculation studies.",
    benefits: "Maintenance allowance + reimbursement of fees.",
    sourceUrl: "https://scholarships.gov.in/",
    rules: [
      { attribute: "occupation", operator: "EQ", value: "student" },
      { attribute: "socialCategory", operator: "EQ", value: "OBC" },
      { attribute: "annualIncome", operator: "LTE", value: 150000 },
    ],
    documents: [DOC.aadhaar, DOC.caste, DOC.income, DOC.bank],
    steps: [
      "Register on the National Scholarship Portal.",
      "Upload OBC certificate, income certificate and admission proof.",
    ],
  },
  {
    slug: "atal-pension-yojana",
    title: "Atal Pension Yojana (APY)",
    ministry: "Ministry of Finance",
    category: "Social Welfare",
    level: "CENTRAL",
    summary:
      "A guaranteed pension scheme for workers in the unorganised sector, aged 18–40, with contributions until age 60.",
    benefits: "Guaranteed monthly pension of ₹1,000–₹5,000 after age 60.",
    sourceUrl: "https://www.npscra.nsdl.co.in/scheme-details.php",
    rules: [
      { attribute: "age", operator: "BETWEEN", value: [18, 40] },
    ],
    documents: [DOC.aadhaar, DOC.bank],
    steps: [
      "Visit your bank or post office where you hold a savings account.",
      "Fill the APY form; contributions are auto-debited monthly.",
    ],
  },
  {
    slug: "pm-shram-yogi-maandhan",
    title: "PM Shram Yogi Maandhan (PM-SYM)",
    ministry: "Ministry of Labour & Employment",
    category: "Social Welfare",
    level: "CENTRAL",
    summary:
      "Voluntary pension scheme for unorganised-sector workers aged 18–40 with monthly income up to ₹15,000.",
    benefits: "Assured pension of ₹3,000/month after age 60.",
    sourceUrl: "https://maandhan.in/",
    rules: [
      { attribute: "age", operator: "BETWEEN", value: [18, 40] },
      { attribute: "annualIncome", operator: "LTE", value: 180000 },
      { attribute: "occupation", operator: "IN", value: ["daily_wage", "self_employed", "homemaker"], orGroup: "worker" },
    ],
    documents: [DOC.aadhaar, DOC.bank],
    steps: [
      "Enrol at a Common Service Centre (CSC) with Aadhaar and a savings/Jan-Dhan account.",
      "Pay the first monthly contribution to activate.",
    ],
  },
  {
    slug: "stand-up-india",
    title: "Stand-Up India",
    ministry: "Ministry of Finance",
    category: "Entrepreneurship",
    level: "CENTRAL",
    summary:
      "Bank loans between ₹10 lakh and ₹1 crore to SC/ST and women entrepreneurs for setting up a greenfield enterprise.",
    benefits: "Composite loan of ₹10 lakh–₹1 crore for a new business.",
    sourceUrl: "https://www.standupmitra.in/",
    rules: [
      { attribute: "age", operator: "GTE", value: 18 },
      { attribute: "socialCategory", operator: "IN", value: ["SC", "ST"], orGroup: "target" },
      { attribute: "gender", operator: "EQ", value: "female", orGroup: "target" },
    ],
    documents: [DOC.aadhaar, DOC.caste, DOC.bank],
    steps: [
      "Apply via standupmitra.in or your bank branch.",
      "Submit business plan, KYC and category proof.",
    ],
  },
  {
    slug: "pm-vishwakarma",
    title: "PM Vishwakarma",
    ministry: "Ministry of Micro, Small & Medium Enterprises",
    category: "Entrepreneurship",
    level: "CENTRAL",
    summary:
      "Support for traditional artisans and craftspeople — skill training, a toolkit incentive, and collateral-free credit.",
    benefits: "₹15,000 toolkit incentive, stipend during training, and low-interest loans.",
    sourceUrl: "https://pmvishwakarma.gov.in/",
    rules: [
      { attribute: "age", operator: "GTE", value: 18 },
      { attribute: "occupation", operator: "IN", value: ["self_employed", "daily_wage"] },
    ],
    documents: [DOC.aadhaar, DOC.bank],
    steps: [
      "Register at a CSC under PM Vishwakarma with Aadhaar.",
      "Verification by the Gram Panchayat / ULB, then training enrolment.",
    ],
  },
  {
    slug: "pm-svanidhi",
    title: "PM Street Vendor's AtmaNirbhar Nidhi (PM SVANidhi)",
    ministry: "Ministry of Housing & Urban Affairs",
    category: "Entrepreneurship",
    level: "CENTRAL",
    summary:
      "Collateral-free working-capital loans for urban street vendors to resume and grow their businesses.",
    benefits: "Working-capital loan starting at ₹10,000 with interest subsidy.",
    sourceUrl: "https://pmsvanidhi.mohua.gov.in/",
    rules: [
      { attribute: "occupation", operator: "IN", value: ["self_employed", "daily_wage"] },
    ],
    documents: [DOC.aadhaar, DOC.bank],
    steps: [
      "Apply via pmsvanidhi.mohua.gov.in or a lending bank/CSC.",
      "Provide vendor certificate / ID issued by the urban local body.",
    ],
  },
  {
    slug: "pmmvy",
    title: "Pradhan Mantri Matru Vandana Yojana (PMMVY)",
    ministry: "Ministry of Women & Child Development",
    category: "Women & Child",
    level: "CENTRAL",
    summary:
      "Maternity benefit providing cash incentive to pregnant and lactating mothers for their first living child.",
    benefits: "₹5,000 in instalments for the first child (more for a second girl child).",
    sourceUrl: "https://wcd.nic.in/schemes/pradhan-mantri-matru-vandana-yojana",
    rules: [
      { attribute: "gender", operator: "EQ", value: "female" },
      { attribute: "age", operator: "GTE", value: 19 },
    ],
    documents: [DOC.aadhaar, DOC.bank],
    steps: [
      "Register at your Anganwadi Centre or approved health facility.",
      "Submit MCP card, Aadhaar and bank details.",
    ],
  },
  {
    slug: "rashtriya-vayoshri-yojana",
    title: "Rashtriya Vayoshri Yojana (RVY)",
    ministry: "Ministry of Social Justice & Empowerment",
    category: "Social Welfare",
    level: "CENTRAL",
    summary:
      "Free assisted-living aids and devices for senior citizens aged 60+ belonging to BPL households.",
    benefits: "Free aids like hearing aids, walking sticks, wheelchairs, spectacles.",
    sourceUrl: "https://rvy.gov.in/",
    rules: [
      { attribute: "age", operator: "GTE", value: 60 },
      { attribute: "rationCardType", operator: "IN", value: ["BPL", "AAY"] },
    ],
    documents: [DOC.aadhaar, DOC.ration],
    steps: [
      "Identification through assessment camps organised in your district.",
      "Carry Aadhaar and BPL proof to the camp.",
    ],
  },
  {
    slug: "national-family-benefit-scheme",
    title: "National Family Benefit Scheme (NFBS)",
    ministry: "Ministry of Rural Development",
    category: "Social Welfare",
    level: "CENTRAL",
    summary:
      "One-time lump-sum assistance to a BPL household on the death of its primary breadwinner.",
    benefits: "One-time payment of ₹20,000 to the bereaved family.",
    sourceUrl: "https://nsap.nic.in/",
    rules: [
      { attribute: "rationCardType", operator: "IN", value: ["BPL", "AAY"] },
    ],
    documents: [DOC.aadhaar, DOC.ration, DOC.bank],
    steps: [
      "Apply through your Gram Panchayat / municipality with the death certificate.",
      "Submit BPL proof and bank details of the surviving head.",
    ],
  },
  {
    slug: "kisan-credit-card",
    title: "Kisan Credit Card (KCC)",
    ministry: "Ministry of Agriculture & Farmers Welfare",
    category: "Agriculture",
    level: "CENTRAL",
    summary:
      "Short-term credit for farmers to meet cultivation and allied expenses at concessional interest rates.",
    benefits: "Crop loans at subsidised interest (as low as 4% with prompt repayment).",
    sourceUrl: "https://www.myscheme.gov.in/schemes/kcc",
    rules: [
      { attribute: "occupation", operator: "EQ", value: "farmer" },
      { attribute: "age", operator: "GTE", value: 18 },
    ],
    documents: [DOC.aadhaar, DOC.land, DOC.bank, DOC.photo],
    steps: [
      "Apply at your bank branch or via the PM-KISAN/KCC portal.",
      "Submit land records, identity and address proof.",
    ],
  },
  {
    slug: "pre-matric-scholarship-disabled",
    title: "Pre-Matric Scholarship for Students with Disabilities",
    ministry: "Department of Empowerment of Persons with Disabilities",
    category: "Education",
    level: "CENTRAL",
    summary:
      "Scholarship for students with disabilities studying in Classes 9 and 10 from low-income families.",
    benefits: "Maintenance allowance, books grant and disability allowance.",
    sourceUrl: "https://scholarships.gov.in/",
    rules: [
      { attribute: "occupation", operator: "EQ", value: "student" },
      { attribute: "isDisabled", operator: "EQ", value: true },
      { attribute: "annualIncome", operator: "LTE", value: 250000 },
    ],
    documents: [DOC.aadhaar, DOC.disability, DOC.income, DOC.bank],
    steps: [
      "Register on the National Scholarship Portal.",
      "Upload disability certificate (UDID), income proof and admission proof.",
    ],
  },
];
