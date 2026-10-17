// News Assistant: ask about current or past news; answers cite real retrieved articles.
import { Suspense } from "react";
import NewsAssistant from "@/components/NewsAssistant";

export const metadata = { title: "Ask · The Morning Edition" };

export default function AssistantPage() {
  return (
    <Suspense>
      <NewsAssistant />
    </Suspense>
  );
}
