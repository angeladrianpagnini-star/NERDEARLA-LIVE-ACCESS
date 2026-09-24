export type GlossaryEntry = {
  canonical: string;
  variants: string[];
};

export const TECHNICAL_GLOSSARY: GlossaryEntry[] = [
  {
    canonical: "Nerdearla",
    variants: [
      "Nardea",
      "Nerdal",
      "Nerdeala",
      "Nerdearla",
    ],
  },
  {
    canonical: "Vibeathon",
    variants: [
      "Vibeathon",
      "Vibe a thon",
      "Vibe-a-thon",
    ],
  },
  {
    canonical: "Gemini",
    variants: [
      "Gemini",
      "Geminy",
    ],
  },
  {
    canonical: "Devpost",
    variants: [
      "Devpost",
      "Dev Post",
    ],
  },
  {
    canonical: "OBS",
    variants: [
      "OBS",
      "O B S",
    ],
  },
  {
    canonical: "vMix",
    variants: [
      "vMix",
      "V Mix",
      "V-Mix",
    ],
  },
];

function escapeRegExp(
  value: string
): string {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

export function applyTechnicalGlossary(
  text: string,
  glossary: GlossaryEntry[] =
    TECHNICAL_GLOSSARY
): string {
  let normalized = text;

  for (const entry of glossary) {
    for (const variant of entry.variants) {
      const pattern =
        new RegExp(
          `\\b${escapeRegExp(variant)}\\b`,
          "gi"
        );

      normalized =
        normalized.replace(
          pattern,
          entry.canonical
        );
    }
  }

  return normalized;
}
