import { healthCheck } from "@/lib/fhir-client";

export async function GET() {
  const status = await healthCheck();
  return Response.json(status);
}
