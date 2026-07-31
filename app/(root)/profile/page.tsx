import { headers } from "next/headers";
import { redirect } from "next/navigation";
import MyProfile from "@/components/profile/MyProfile";
import { auth } from "@/lib/auth";

export default async function MyProfilePage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/");
  }

  return <MyProfile />;
}
