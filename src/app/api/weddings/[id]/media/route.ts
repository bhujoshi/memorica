import { NextRequest } from "next/server";
import { upload } from "@/lib/routes/media/route";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest, { params }: { params: { id: string } }) { return upload(req, params.id); }
