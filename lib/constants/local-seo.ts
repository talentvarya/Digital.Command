// A fixed checklist of common local-business citation directories — no
// scraping/API involved, the client just marks which ones they're already
// listed on. Mixed India-focused + global since Digital Command's own
// client base is India-based but the app isn't India-only.
export const LOCAL_CITATION_DIRECTORIES: { name: string; url: string }[] = [
  { name: "Google Business Profile", url: "https://business.google.com" },
  { name: "Facebook Page", url: "https://facebook.com" },
  { name: "Bing Places", url: "https://www.bingplaces.com" },
  { name: "Apple Maps (Business Connect)", url: "https://businessconnect.apple.com" },
  { name: "Justdial", url: "https://www.justdial.com" },
  { name: "Sulekha", url: "https://www.sulekha.com" },
  { name: "IndiaMART", url: "https://www.indiamart.com" },
  { name: "Yelp", url: "https://www.yelp.com" },
];
