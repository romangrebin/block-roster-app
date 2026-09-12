import Link from "next/link";
import { getUserFromServerComponent } from "@/lib/auth";
import { getRepository } from "@/lib/db";
import { listApprovedResidentBlocks } from "@/lib/application";
import type { Block } from "@/lib/types";
import PageContainer from "@/components/PageContainer";
import EnterCodeBox from "@/components/EnterCodeBox";

const HOW_IT_WORKS = [
  {
    title: "A steward sets up the community",
    body: "Draw the boundary, list the addresses. Day one starts as a visible gap, not a guess.",
  },
  {
    title: "Neighbors get a code, not a public link",
    body: "Pick your address, verify your email — done in under a minute. The code isn't listed anywhere.",
  },
  {
    title: "A steward approves you, then it's your community too",
    body: "See your neighbors, read what your steward posted, export anytime.",
  },
];

const PRIMARY_BUTTON_CLASS =
  "inline-block bg-accent text-white px-6 py-3 rounded-full text-lg font-medium hover:bg-accent-dark transition-colors shadow-[0_8px_16px_-6px_rgba(194,84,46,0.5)]";

type BlockRole = "steward" | "resident";
type BlockEntry = { block: Block; total: number; role: BlockRole };

async function loadBlockEntry(
  repo: ReturnType<typeof getRepository>,
  block: Block,
  role: BlockRole
): Promise<BlockEntry> {
  const residences = await repo.residences.listByBlock(block.id);
  return { block, total: residences.length, role };
}

export default async function Home() {
  const user = await getUserFromServerComponent();
  const repo = getRepository();

  let blocks: BlockEntry[] = [];
  if (user) {
    const stewardBlockIds = new Set<string>();
    const activeStewardships = (await repo.stewards.listByUserId(user.id)).filter((s) => s.status === "active");
    const stewardEntries = (
      await Promise.all(
        activeStewardships.map(async (steward) => {
          const block = await repo.blocks.getById(steward.blockId);
          if (!block) return null;
          stewardBlockIds.add(block.id);
          return loadBlockEntry(repo, block, "steward");
        })
      )
    ).filter((entry) => entry !== null);

    const memberBlocks = await listApprovedResidentBlocks(user.id);
    const residentEntries = await Promise.all(
      memberBlocks
        .filter(({ block }) => !stewardBlockIds.has(block.id))
        .map(({ block }) => loadBlockEntry(repo, block, "resident"))
    );

    blocks = [...stewardEntries, ...residentEntries];
  }

  return (
    <>
      {/* Temporary migration aid for the ourblock.community domain cutover — set
          PREVIOUS_SITE_URL once the old site moves elsewhere, unset it (no code change needed)
          once the transition period is over. Home page only, since this is where anyone with the
          old link or a bookmark would land. Now that this app is *also* called Our Block (see the
          2026-09-11 rename), the copy has to actively disambiguate "new site" from "classic site,"
          not just say "previous version" — both are now "Our Block." */}
      {process.env.PREVIOUS_SITE_URL && (
        <div className="bg-accent-soft text-accent-soft-ink text-sm text-center py-2 px-4">
          This is a new version of Our Block. Looking for the version prior to Sept 10, 2026?{" "}
          <a href={process.env.PREVIOUS_SITE_URL} className="underline font-medium">
            It&apos;s still here
          </a>
          .
        </div>
      )}
      <PageContainer className="space-y-12">
        {user && blocks.length > 0 && (
          <div className="max-w-xl mx-auto w-full text-left space-y-4">
            <h2 className="text-lg font-medium text-ink">Your communities</h2>
            <ul className="divide-y divide-border border border-border rounded-2xl bg-surface">
              {blocks.map(({ block, total, role }) => (
                <li key={block.id}>
                  <Link
                    href={`/${block.code}`}
                    className="flex items-center justify-between px-5 py-4 hover:bg-surface-muted transition-colors gap-4"
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span className="text-lg font-medium text-ink truncate">{block.name}</span>
                      <span
                        className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                          role === "steward" ? "bg-accent-soft text-accent-soft-ink" : "bg-surface-muted text-muted"
                        }`}
                      >
                        {role === "steward" ? "Steward" : "Resident"}
                      </span>
                    </span>
                    <span className="shrink-0 text-base text-muted">
                      {total} residence{total === 1 ? "" : "s"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="text-center space-y-5 max-w-2xl mx-auto">
          <h1 className="text-4xl font-semibold text-ink">Know your neighbors.</h1>
          <p className="text-lg text-muted leading-8">
            Built by neighbors, for neighbors. Social tech to deepen human connection, not
            replace it. A growing set of simple tools for your block.
          </p>
          <div className="flex flex-col items-center gap-2 pt-2">
            <EnterCodeBox />
            <p className="text-sm text-muted">Have a code from a neighbor or a steward? Enter it above.</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
          {HOW_IT_WORKS.map((step, i) => (
            <div key={step.title} className="space-y-1.5">
              <p className="text-sm font-medium text-accent">Step {i + 1}</p>
              <h3 className="text-base font-semibold text-ink">{step.title}</h3>
              <p className="text-sm text-muted">{step.body}</p>
            </div>
          ))}
        </div>

        <div className="text-center">
          {!user ? (
            <p className="text-base text-muted">Sign in (top right) to see or create your community.</p>
          ) : (
            <Link href="/blocks/new" className={PRIMARY_BUTTON_CLASS}>
              {blocks.some((b) => b.role === "steward") ? "Create another community" : "Create a community"}
            </Link>
          )}
        </div>
      </PageContainer>
    </>
  );
}
