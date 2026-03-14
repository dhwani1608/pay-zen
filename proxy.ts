// proxy.ts
import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

// Routes only meant for unauthenticated users
const authRoutes = ["/register", "/login", "/api/auth/signin"];
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  // If user is already logged in and visits login/register
  if (isAuthRoute) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL("/", req.nextUrl));
    }

    return NextResponse.next();
  }

  // Optional: protect dashboard
  // if (pathname.startsWith("/dashboard") && !isLoggedIn) {
  //   return NextResponse.redirect(new URL("/api/auth/signin", req.nextUrl))
  // }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
