import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
export declare function middleware(request: NextRequest): NextResponse<unknown>;
export declare const config: {
    matcher: string[];
};
