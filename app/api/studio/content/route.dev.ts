import { NextResponse } from "next/server";
import { isCollection, readJson, writeJson } from "@/lib/server/studio";

export async function GET(req: Request) {
  const name = new URL(req.url).searchParams.get("collection");
  if (!isCollection(name)) return NextResponse.json({ error: "Unknown collection" }, { status: 400 });
  return NextResponse.json(await readJson(name));
}

export async function PUT(req: Request) {
  const name = new URL(req.url).searchParams.get("collection");
  if (!isCollection(name)) return NextResponse.json({ error: "Unknown collection" }, { status: 400 });
  let data: unknown;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ error: "The data is not valid JSON" }, { status: 400 });
  }
  if (name !== "site" && !Array.isArray(data)) {
    return NextResponse.json({ error: "Expected a list of entries" }, { status: 400 });
  }
  await writeJson(name, data);
  return NextResponse.json({ ok: true });
}
