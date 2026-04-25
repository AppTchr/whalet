import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Landing } from "@/components/landing/landing";

const AUTH_COOKIE_NAME = "access_token";

export default async function Home() {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get(AUTH_COOKIE_NAME);

  if (authCookie?.value) {
    redirect("/wallets");
  }

  return <Landing />;
}
