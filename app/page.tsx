import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth-user";

export default async function Home() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  redirect("/boite");
}
