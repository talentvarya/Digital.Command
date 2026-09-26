// Builds the text prompt for the AI picture behind a post graphic. The image model
// (FLUX) is good at photographs and poor at lettering, so the prompt asks for a
// picture with no text and leaves the words to the renderer. When the client (or
// the AI's own suggestion) has described the picture, that description leads.

export interface ImagePromptInput {
  headline: string;
  businessName: string;
  // What the picture should show, in the client's words (or the AI's suggestion).
  subject?: string | null;
  businessDescription?: string | null;
  productsServices?: string | null;
  imageStyle?: string | null;
  wordsToAvoid?: string[] | null;
}

const MAX_PROMPT_CHARS = 1200;

function oneLine(text: string | null | undefined, max: number): string {
  return (text ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

// Someone who asks for an illustration or a 3D render shouldn't be forced into a photo.
const NOT_A_PHOTO = /illustrat|cartoon|drawing|painting|3d|render|flat design|vector|watercolou?r|sketch|anime|icon|infographic/i;

export function buildImagePrompt(input: ImagePromptInput): string {
  const about = oneLine(input.businessDescription, 220) || oneLine(input.productsServices, 220);
  const subject = oneLine(input.subject, 400);
  const style = oneLine(input.imageStyle, 200);

  const parts = [
    `A professional, eye-catching image for a social media post by "${oneLine(input.businessName, 60)}"${about ? `, ${about}` : ""}.`,
    subject
      ? `The picture should show: ${subject}. (For context, the post is about: ${oneLine(input.headline, 120)}.)`
      : `The post is about: ${oneLine(input.headline, 120)}.`,
    style ? `Visual style: ${style}.` : "Bright, natural lighting, warm and inviting.",
  ];
  if (!NOT_A_PHOTO.test(`${subject} ${style}`)) parts.push("Photorealistic photograph.");
  parts.push(
    "Clean composition with calm, uncluttered space where text can be placed over the image.",
    "No text, no letters, no logos, no watermarks, no borders."
  );

  const avoid = (input.wordsToAvoid ?? []).map((w) => w.trim()).filter(Boolean).slice(0, 12);
  if (avoid.length > 0) parts.push(`Do not depict: ${avoid.join(", ")}.`);

  return parts.join(" ").slice(0, MAX_PROMPT_CHARS);
}
