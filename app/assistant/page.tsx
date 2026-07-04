import type { Metadata } from "next";
import { AssistantChat } from "@/components/assistant-chat";

export const metadata: Metadata = {
  title: "Ask the assistant",
  description:
    "Describe your situation and get pointed to the government schemes you may qualify for.",
};

export default function AssistantPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5">
      <AssistantChat />
    </main>
  );
}
