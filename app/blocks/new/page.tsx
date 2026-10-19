import { getUserFromServerComponent } from "@/lib/auth";
import CreateBlockForm from "@/components/CreateBlockForm";
import PageContainer from "@/components/PageContainer";

export default async function NewBlockPage() {
  const user = await getUserFromServerComponent();

  if (!user) {
    return (
      <PageContainer className="flex items-center justify-center">
        <p className="text-muted">Sign in as a steward first — use the button top right.</p>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="space-y-6">
      <p className="bg-accent-soft text-accent-soft-ink text-sm rounded-2xl px-4 py-3">
        <strong>Heads up:</strong> this setup flow hasn&apos;t been updated in a while and may be rough
        around the edges. Everything still works, but expect a few quirks.
      </p>
      <div>
        <h1 className="text-3xl font-semibold text-ink">Create a community</h1>
        <p className="text-lg text-muted mt-2">
          Draw your community&apos;s boundary, then add residences on the next page. You&apos;re its
          founding steward — once a neighbor is an approved resident, you can make them a
          co-steward too.
        </p>
      </div>
      <CreateBlockForm />
    </PageContainer>
  );
}
