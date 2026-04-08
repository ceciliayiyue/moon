export const runtime = "nodejs";

const QUICK_DRAW_REMOTE_URL =
  "https://storage.googleapis.com/quickdraw_dataset/full/simplified/moon.ndjson";

export async function GET() {
  const response = await fetch(QUICK_DRAW_REMOTE_URL, {
    headers: {
      Accept: "application/x-ndjson",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return new Response("Failed to fetch moon data", { status: response.status });
  }

  return new Response(response.body, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
