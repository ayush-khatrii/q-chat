import { publicPageMetadata, siteDescription } from "@/lib/site";
export const metadata = publicPageMetadata(
  "QChat — Quick, hassle-free chatting",
  siteDescription,
  "/",
);
import HomePage from "@/components/pages/HomePage";

const page = () => {
  return <HomePage />;
};

export default page;
