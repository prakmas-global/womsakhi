"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Btn, Card, EmptyState, ScreenSkeleton } from "@/components/ux/kit";
import { apiJoinCircleByCode } from "@/lib/share-api";
import { apiErrorMessage } from "@/lib/api";

/**
 * Where an invite link lands once she is signed in: joins her with the code,
 * then opens the circle. Once — a refresh does not join her twice (the server
 * is idempotent anyway).
 */
export default function JoinByCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const [error, setError] = useState("");
  const tried = useRef(false);

  useEffect(() => {
    if (tried.current) return;
    tried.current = true;
    apiJoinCircleByCode(code)
      .then((r) => router.replace(`/app/circles/${r.circle_id}`))
      .catch((e) => setError(apiErrorMessage(e, "That invite did not work. Ask her for a new link.")));
  }, [code, router]);

  return (
    <HomeShell>
      {error ? (
        <Card>
          <EmptyState icon="Link2Off" title="Could not join" body={error}
                      action={<Btn href="/app/circles" variant="outline">See circles</Btn>} />
        </Card>
      ) : (
        <ScreenSkeleton shape="list" />
      )}
    </HomeShell>
  );
}
