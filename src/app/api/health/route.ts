const ANYPOINT_BASE =
  process.env.ANYPOINT_EXPERIENCE_API_URL ||
  "https://agent-tools-exp-api-sewtob.5sc6y6-1.usa-e2.cloudhub.io";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

export async function GET() {
  const res = await fetch(`${ANYPOINT_BASE}/api/v1/agent/health`);
  if (!res.ok) return Response.json({ status: "error", code: res.status }, { status: 502, headers: CORS });
  return Response.json(await res.json(), { headers: CORS });
}

export async function OPTIONS() {
  return new Response(null, { headers: CORS });
}
