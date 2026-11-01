import { redirect } from "next/navigation";

export default function RegisterRoute(): never {
  redirect("/login");
}
