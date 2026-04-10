import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Connexion",
  description: "Connectez-vous à votre compte",
};

export default function LoginPage() {
  return <LoginForm />;
}
