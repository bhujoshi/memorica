import { NextRequest } from "next/server";
import { read } from "@/lib/routes/media/route";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) { return read(params.id); }
