import { createFileRoute } from "@tanstack/react-router";
import { OperatorApp } from "@/components/operator/operator-app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <OperatorApp />;
}
