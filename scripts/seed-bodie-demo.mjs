// Seeds (or resets) the Bodie demo community: its two descriptions, the 14 neighbors, and their
// Lending Library items. Story source: notes/demo-story-draft.md (local notes, not in the repo).
//
//   node --env-file=.env.local scripts/seed-bodie-demo.mjs            # apply
//   node --env-file=.env.local scripts/seed-bodie-demo.mjs --dry-run  # show the plan only
//
// Safe to re-run: it deletes only residents whose names are in CAST or FORMER_CAST_NAMES (their
// items go with them via ON DELETE CASCADE) and re-creates the cast. Real visitors who joined the demo are left alone. It
// does overwrite the community's descriptions and settings.

import { createClient } from '@supabase/supabase-js'

const BLOCK_CODE = 'bodie-ca'
const dryRun = process.argv.includes('--dry-run')

const PUBLIC_DESCRIPTION = `**⛏️ Gold has been discovered in Bodie!** It's the richest strike in California. Thousands are pouring in, and the best claims won't last. Be part of it before it's too late.

---

*What is this?* A demo community of **Our Block** (this app; built to connect neighbors), turned into a playable, educational narrative set in 1879. Bodie is a real California ghost town: most houses on this map still stand, and most of the people here really lived in them. Join as a newcomer, pick an empty house, and say a bit about yourself. Then meet your neighbors and see if you can help the community during your first winter. You'll get a sign-in link by email. Takes up to 15 minutes.

Curious about the real Bodie? [Read the history behind the story](/bodie-ca/expedition/sources).`

const PRIVATE_DESCRIPTION = `You came for the gold and the hope of creating a life for yourself, just like everyone else.

Nobody warned you about the winter.

It's November 1879. The woodpiles are nearly gone, and a cord costs twenty dollars, most of a week's pay. Last night at the Miners' Union Hall they decided four people would take two wagons and their mules south to the pines past Mono Lake and bring back what they can before the passes close.

You said you'd go. Someone had to, and it's a good way to make a name for yourself. You'll have to choose the other three party members carefully: who they are, what they know, what they'd lend.

*How to play: get to know your neighbors on the map, check the Lending Library for anything worth borrowing, then head to the **Expedition** tab to choose your party: three neighbors to go with you, and two borrowed things. This Bodie community was built using features generally available in Our Block, besides the Expedition tab.*`

// Keyed by residence label exactly as drawn in the app. Real people keep their documented facts;
// voices, feelings, and invented occupants are fiction (see the draft's ground rules).
const CAST = [
  {
    residence: 'J.S. Cain Residence',
    name: 'James Stuart Cain',
    blurb: "Martha and I came up this year. I'm in lumber, and this winter, that makes me the most popular man in town.",
    movedInYear: 1879,
    favoriteSpot: 'The south shore at dawn, where the barges load',
    countMeInFor: 'A good argument about prices',
    askMeAbout: 'Running barges across Mono Lake, and which shore to land on',
    items: [{ name: 'Chart of the Mono Lake shore', category: 'other', description: 'Hand-drawn, with the springs marked. Bring it back dry.' }],
  },
  {
    residence: 'D.V. Cain House',
    name: 'Ella Cody Cain',
    blurb: 'People mix David up with the lumber Cain. He lets them; it gets us better credit at the store. We were here before the rush, when you could hear yourself think.',
    movedInYear: 1873,
    favoriteSpot: 'The hill behind the house, before all these new roofs',
    countMeInFor: 'A quiet supper',
    askMeAbout: 'What Bodie was like with forty people instead of four thousand',
    items: [{ name: 'Two-person crosscut saw', category: 'tool', description: 'Six feet, two handles. Needs two people who get along.' }],
  },
  {
    residence: 'Seiler House',
    name: 'Theresa Seiler',
    blurb: 'August pours, and I keep the books, the peace, and four children. Between us we run the warmest saloon in Bodie.',
    movedInYear: 1878,
    favoriteSpot: "Behind my own bar, when the stove is going and someone's singing",
    countMeInFor: 'Anything that needs a song',
    askMeAbout: "The best song you've never heard",
    items: [{ name: "August's fiddle", category: 'other', description: "It's his, but I'm the one who decides whether it leaves the house." }],
  },
  {
    residence: 'Miller House',
    name: 'Tom Miller',
    blurb: 'Teamster. Jessie says I talk to the mules more than to her, and, well... the mules listen better.',
    movedInYear: 1878,
    favoriteSpot: 'The stable at night, when the mules have settled',
    countMeInFor: 'A long haul',
    askMeAbout: 'Getting a loaded wagon down a hill it has no business going down',
    items: [],
  },
  {
    residence: 'Cameron House',
    name: 'Andrew Cameron',
    blurb: "Miner. Neither the cold nor the dark much bothers me anymore. My wife says it's the only reason I'm useful.",
    movedInYear: 1879,
    favoriteSpot: "Anywhere with a roof when the wind's up",
    countMeInFor: 'Anything but another night underground',
    askMeAbout: 'The winter I spent snowed into a Sierra camp, and how we lived through it',
    items: [],
  },
  {
    residence: 'L.E. Bell House',
    name: 'Hannah Price',
    blurb: "Widow. I nursed miners in Virginia City for six years, so you can't show me anything that will make me faint.",
    movedInYear: 1879,
    favoriteSpot: 'My own kitchen, with the kettle on',
    countMeInFor: "Whatever needs doing, if you'll be quick about it",
    askMeAbout: 'Why you never thaw frozen fingers by the fire',
    items: [],
  },
  {
    residence: 'McDonald House',
    name: 'Dan McDonald',
    blurb: 'I work nights at the Standard. Strong opinions, stronger coffee.',
    movedInYear: 1878,
    favoriteSpot: "The Standard's hoist house, which is warm",
    countMeInFor: 'An argument about anything',
    askMeAbout: 'Which saloon has the warmest stove',
    items: [],
  },
  {
    residence: 'Donnelly House',
    name: 'Annie Donnelly',
    blurb: 'Charlie and I came out from back east, where we farmed until he caught gold fever and I caught it from him. I took to skiing our first winter, which the miners find very funny.',
    movedInYear: 1878,
    favoriteSpot: 'The slope behind the house after fresh snow',
    countMeInFor: 'A race downhill',
    askMeAbout: 'The farm back east, which I miss more than I admit',
    items: [
      {
        name: 'Long snowshoes',
        category: 'tool',
        description: 'Ten-foot Norwegian skis and a single pole. Faster than walking over deep snow, once you stop falling.',
      },
    ],
  },
  {
    residence: 'Dolan House',
    name: 'Clara Holt',
    blurb: "I teach the children who'll sit still, and some who won't. I'm also the one who stood up at the Miners' Union Hall and said someone had to go for wood. I'd go myself, but thirty children can't teach themselves.",
    movedInYear: 1879,
    favoriteSpot: 'The schoolroom after the children leave',
    countMeInFor: 'Reading aloud on a long night',
    askMeAbout: "Poetry, if you've the patience",
    items: [{ name: 'A book of poems', category: 'book', description: 'Well read and a little water-stained. Longfellow, mostly.' }],
  },
  {
    residence: 'Bodie Methodist Church',
    name: 'Josiah Webb',
    // Deliberate liberty, disclosed on the sources page: the church was really completed in 1882.
    blurb: "I preach here and sleep in the back room, which is warmer than it sounds. We have walls and pews. What we don't have is a bell.",
    movedInYear: 1879,
    favoriteSpot: 'The front steps at sundown, when the whole town is in view',
    countMeInFor: 'Raising money for a bell',
    askMeAbout: 'Where the bell will hang, once we have one',
    items: [],
  },
  {
    residence: 'Saddle Room',
    name: 'Harvey Boone',
    blurb: "I run the general store. This old saddle room is where I keep the overflow, and where I sleep. If I don't have it, it's on a wagon somewhere between here and Carson City.",
    movedInYear: 1878,
    favoriteSpot: "My own shelves, fully stocked, which hasn't happened since August",
    countMeInFor: "Lending, at a fair price, or free if it's for the town",
    askMeAbout: "What's running short",
    items: [{ name: 'Iron-shod spare axle', category: 'tool', description: 'The last wagon axle in town until spring.' }],
  },
  {
    residence: 'Sawmill',
    name: 'Wing Yee',
    blurb: "I live on King Street and work here at the sawmill. The mines won't hire us, so I cut wood. Most of the wood in your stove probably passed through my hands.",
    movedInYear: 1878,
    favoriteSpot: 'The east shore of the lake, where the springs run sweet',
    countMeInFor: 'The trip south, if King Street gets its share of the wood',
    askMeAbout: 'Where the good timber is, and which springs you can drink from',
    items: [],
  },
  {
    residence: 'Red Barn',
    name: 'Ruth Hartley',
    blurb: 'I run the livery. Sam runs the forge; I run everything else, including the wagons when they break down on the road. We live up in the loft.',
    movedInYear: 1878,
    favoriteSpot: 'The stalls at feeding time',
    countMeInFor: 'Anything with wheels',
    askMeAbout: 'Fixing anything with a wheel on it, out on the road, in any weather',
    items: [],
  },
  {
    residence: 'Sturgeon House',
    name: 'Pete Sturgeon',
    blurb: "Trapper. Been in these mountains longer than the town has. My daughter writes from Carson City every month, asking when I'll come down. Not yet.",
    movedInYear: 1871,
    favoriteSpot: 'Anywhere nobody else has found yet',
    countMeInFor: 'Not much, these days',
    askMeAbout: "The mountains, though I won't tell you everything",
    items: [{ name: 'Buffalo robe', category: 'other', description: "Keeps the frost off a sleeping man. Can't do much for one who's already frozen. Smells like me." }],
  },
]

// Swapped-out characters, removed on re-seed so they don't linger in the demo.
const FORMER_CAST_NAMES = ['David Victor Cain', 'August Seiler', 'Charlie Donnelly', 'Sam Hartley']

function check(result, what) {
  if (result.error) throw new Error(`${what}: ${result.error.message}`)
  return result.data
}

const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const block = check(await client.from('blocks').select('id, name').eq('code', BLOCK_CODE).single(), 'find block')
const residences = check(await client.from('residences').select('id, label').eq('block_id', block.id), 'list residences')
const residenceIdByLabel = new Map(residences.map((r) => [r.label, r.id]))

const missingLabels = CAST.map((c) => c.residence).filter((label) => !residenceIdByLabel.has(label))
if (missingLabels.length > 0) throw new Error(`Residences not found in ${BLOCK_CODE}: ${missingLabels.join(', ')}`)

const existingCast = check(
  await client
    .from('residents')
    .select('id, name')
    .in('residence_id', [...residenceIdByLabel.values()])
    .in('name', [...CAST.map((c) => c.name), ...FORMER_CAST_NAMES]),
  'find existing cast'
)

const itemCount = CAST.reduce((sum, c) => sum + c.items.length, 0)
console.log(`${block.name} (/${BLOCK_CODE}): replacing ${existingCast.length} existing cast resident(s) with ${CAST.length}, plus ${itemCount} items, and setting descriptions and settings.`)
if (dryRun) process.exit(0)

if (existingCast.length > 0) {
  check(await client.from('residents').delete().in('id', existingCast.map((r) => r.id)), 'delete old cast')
}

check(
  await client
    .from('blocks')
    .update({
      public_blurb: PUBLIC_DESCRIPTION,
      private_notes: PRIVATE_DESCRIPTION,
      lending_library_enabled: true,
      borrow_requests_enabled: true,
      auto_approve_joins: true,
      resident_export_enabled: false,
      hidden_signup_prompts: ['movedInYear', 'askMeAbout'],
    })
    .eq('id', block.id),
  'set descriptions and settings'
)

const approvedAt = new Date().toISOString()
for (const neighbor of CAST) {
  const resident = check(
    await client
      .from('residents')
      .insert({
        residence_id: residenceIdByLabel.get(neighbor.residence),
        name: neighbor.name,
        status: 'approved',
        approved_at: approvedAt,
        blurb: neighbor.blurb,
        moved_in_year: neighbor.movedInYear,
        favorite_spot: neighbor.favoriteSpot,
        count_me_in_for: neighbor.countMeInFor,
        ask_me_about: neighbor.askMeAbout,
      })
      .select('id')
      .single(),
    `insert ${neighbor.name}`
  )
  if (neighbor.items.length > 0) {
    check(
      await client.from('items').insert(neighbor.items.map((item) => ({ ...item, resident_id: resident.id }))),
      `insert items for ${neighbor.name}`
    )
  }
}

console.log('Done.')
