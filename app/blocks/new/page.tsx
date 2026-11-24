import { getUserFromServerComponent } from "@/lib/auth";
import CreateBlockForm from "@/components/CreateBlockForm";
import PageContainer from "@/components/PageContainer";
import CommunityRequestForm from "@/components/CommunityRequestForm";
import MagicLinkSignInForm from "@/components/MagicLinkSignInForm";
import { COMMUNITY_CREATION_OPEN, MAX_FOUNDED_COMMUNITIES_PER_USER, communityRequestsEnabled, isAdmin } from "@/lib/admin";
import { countFoundedCommunities } from "@/lib/application";

export default async function NewBlockPage() {
  const user = await getUserFromServerComponent();

  if (!COMMUNITY_CREATION_OPEN) {
    const requestsEnabled = communityRequestsEnabled();
    return (
      <PageContainer className="space-y-6 max-w-2xl mx-auto">
        <div>
          <h1 className="text-3xl font-semibold text-ink">Start a community</h1>
          <p className="text-lg text-muted mt-2">
            New communities are paused for now while Our Block is in a small pilot.{" "}
            {requestsEnabled
              ? "Want one for your block? Tell Roman a little about it and you'll hear back by email."
              : "Check back soon."}
          </p>
        </div>
        {requestsEnabled && <CommunityRequestForm signedInEmail={user?.email ?? null} />}
      </PageContainer>
    );
  }

  if (!user) {
    return (
      <PageContainer className="space-y-6 max-w-md mx-auto">
        <div>
          <h1 className="text-3xl font-semibold text-ink">Create a community</h1>
          <p className="text-lg text-muted mt-2">
            Sign in first. We&apos;ll email you a link that brings you right back here.
          </p>
        </div>
        <MagicLinkSignInForm returnPath="/blocks/new" />
      </PageContainer>
    );
  }

  if (!isAdmin(user.email) && (await countFoundedCommunities(user.id)) >= MAX_FOUNDED_COMMUNITIES_PER_USER) {
    return (
      <PageContainer className="space-y-3 max-w-2xl mx-auto">
        <h1 className="text-3xl font-semibold text-ink">Create a community</h1>
        <p className="text-lg text-muted">
          You&apos;ve created {MAX_FOUNDED_COMMUNITIES_PER_USER} communities, the most one person can have. To make
          room, delete one you no longer need from its Manage tab.
        </p>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="space-y-6">
      <p className="bg-accent-soft text-accent-soft-ink text-sm rounded-2xl px-4 py-3">
        <strong>Thanks for being an early tester!</strong> If anything is quirky or confusing, please tell
        Roman.
      </p>
      <div>
        <h1 className="text-3xl font-semibold text-ink">Create a community</h1>
        <p className="text-lg text-muted mt-2">
          Name it and draw its boundary, then add residences on the next page. You&apos;re its
          founding steward — once a neighbor is an approved resident, you can make them a
          co-steward too.
        </p>
      </div>
      <CreateBlockForm />
    </PageContainer>
  );
}
