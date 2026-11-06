import { sql } from "@/shared/db/client";

// Real healthcheck: app is up AND the database answers. Used by deploy/deploy.sh.
export async function GET() {
  try {
    await sql()`select 1`;
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "db_down" }, { status: 503 });
  }
}
