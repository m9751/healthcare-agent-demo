import { healthCheck } from "@/lib/experience-api/agent-tools";

export async function GET() {
  const status = await healthCheck();
  return Response.json(status);
}
