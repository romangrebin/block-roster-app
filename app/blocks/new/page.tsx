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
