// Builds the text prompt for the AI photo behind a post graphic. The image model
// (FLUX) is good at photographs and poor at lettering, so the prompt asks for a
// clean photo with no text and leaves the words to the renderer.

export interface ImagePromptInput {
  headline: string;
  businessName: string;
  businessDescription?: string | null;
  productsServices?: string | null;
  imageStyle?: string | null;
  wordsToAvoid?: string[] | null;
}

const MAX_PROMPT_CHARS = 1200;

function oneLine(text: string | null | undefined, max: number): string {
  return (text ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

export function buildImagePrompt(input: ImagePromptInput): string {
  const about = oneLine(input.businessDescription, 220) || oneLine(input.productsServices, 220);
  const parts = [
    `A professional, eye-catching photograph for a social media post by "${oneLine(input.businessName, 60)}"${about ? `, ${about}` : ""}.`,
    `The post is about: ${oneLine(input.headline, 120)}.`,
    input.imageStyle ? `Visual style: ${oneLine(input.imageStyle, 200)}.` : "Bright, natural lighting, warm and inviting.",
    "Clean composition with calm, uncluttered space where text can be placed over the image.",
    "No text, no letters, no logos, no watermarks, no borders.",
  ];

  const avoid = (input.wordsToAvoid ?? []).map((w) => w.trim()).filter(Boolean).slice(0, 12);
  if (avoid.length > 0) parts.push(`Do not depict: ${avoid.join(", ")}.`);

  return parts.join(" ").slice(0, MAX_PROMPT_CHARS);
}
