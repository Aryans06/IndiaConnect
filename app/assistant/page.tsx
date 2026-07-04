import type { Metadata } from "next";
import { AssistantChat } from "@/components/assistant-chat";
import { getLocale } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "Ask the assistant",
  description:
    "Describe your situation and get pointed to the government schemes you may qualify for.",
};

export default async function AssistantPage() {
  const locale = await getLocale();
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5">
      <AssistantChat locale={locale} />
    </main>
  );
}
