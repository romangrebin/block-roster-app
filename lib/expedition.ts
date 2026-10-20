// The Expedition is a game that exists only in the Bodie demo community. Story and design:
// notes/demo-story-draft.md and notes/demo-community.md. Names here must match the seeded
// residents and items in scripts/seed-bodie-demo.mjs.
export const EXPEDITION_BLOCK_CODE = 'bodie-ca'

export const PARTY_SIZE = 3
export const BORROWED_ITEM_COUNT = 2

export type Neighbor = { name: string; residence: string; colorLine: string }

export const NEIGHBORS: Neighbor[] = [
  {
    name: 'James Stuart Cain',
    residence: 'J.S. Cain Residence',
    colorLine: 'Mr. Cain priced every tree we passed, out loud. By the third day it was a game.',
  },
  {
    name: 'Ella Cody Cain',
    residence: 'D.V. Cain House',
    colorLine:
      "Ella told us what Bodie was like with forty people in it. I couldn't picture it. She said I'd see it again someday.",
  },
  {
    name: 'Theresa Seiler',
    residence: 'Seiler House',
    colorLine: 'Theresa kept the coffee hot and the arguments short. Nobody fought once.',
  },
  { name: 'Tom Miller', residence: 'Miller House', colorLine: 'Tom said goodnight to every mule by name.' },
  {
    name: 'Andrew Cameron',
    residence: 'Cameron House',
    colorLine: "Andrew hasn't been above ground this long in years. He kept looking up.",
  },
  {
    name: 'Hannah Price',
    residence: 'L.E. Bell House',
    colorLine: "Hannah checked everyone's hands and feet every night, like a mother counting children.",
  },
  {
    name: 'Dan McDonald',
    residence: 'McDonald House',
    colorLine: 'Dan carried more than his share and complained about all of it.',
  },
  {
    name: 'Annie Donnelly',
    residence: 'Donnelly House',
    colorLine: 'Annie raced down every slope we came to. Twice she won.',
  },
  {
    name: 'Clara Holt',
    residence: 'Dolan House',
    colorLine: "Clara taught us the constellations. I'd never known their names.",
  },
  {
    name: 'Josiah Webb',
    residence: 'Bodie Methodist Church',
    colorLine: 'Brother Webb said grace over beans as if they were a feast. By the end, they were.',
  },
  {
    name: 'Harvey Boone',
    residence: 'Saddle Room',
    colorLine: "Harvey kept a ledger of everything we used. 'For the town,' he said, and then crossed it all out.",
  },
  {
    name: 'Wing Yee',
    residence: 'Sawmill',
    colorLine: 'Wing taught me to split a log with the grain. Three swings instead of ten.',
  },
  {
    name: 'Ruth Hartley',
    residence: 'Red Barn',
    colorLine: 'Ruth checked every wheel, every morning, before anyone was allowed coffee.',
  },
  {
    name: 'Pete Sturgeon',
    residence: 'Sturgeon House',
    colorLine: "Pete read his daughter's latest letter by the fire, then folded it away without a word.",
  },
]

const ITEM_COLOR_LINES: Record<string, string> = {
  'Chart of the Mono Lake shore': "We didn't need the chart in the end, but it was a comfort to have.",
  'Two-person crosscut saw': 'The big saw made short work of the camp wood, too.',
  "August's fiddle": "August's fiddle came out after supper. For an hour it wasn't cold.",
  'Long snowshoes': 'Someone took the skis out just for fun and came back laughing, covered in snow.',
  'A book of poems': "Someone read poems aloud by the fire. I didn't know I liked poems.",
  'Iron-shod spare axle': 'We hauled that spare axle the whole way. I tried not to resent it.',
  'Buffalo robe':
    "Pete's buffalo robe kept the frost off whoever had the last watch. It smelled like him. Nobody complained.",
}

function itemColorLine(itemName: string) {
  return ITEM_COLOR_LINES[itemName] ?? `The ${itemName} rode along in the wagon the whole way.`
}

/** Whoever or whatever handles a challenge: the first listed answer in the party is used. */
type Answer = { neighbor?: string; item?: string; line: string }

/** `hint` follows a failure, pointing at the kind of help that was missing without naming anyone. */
type Challenge = { day: number; title: string; answers: Answer[]; failure: string; hint: string }

const CHALLENGES: Challenge[] = [
  {
    day: 1,
    title: 'The icy grade',
    answers: [
      {
        neighbor: 'Tom Miller',
        line: 'Tom chained the back wheels and the wagon slid down the grade like a reluctant child. Nobody spoke until the bottom.',
      },
    ],
    failure:
      'The second wagon slid off the grade and broke a wheel. We lost half a day getting it back on the road. The mules were fine. We were not.',
    hint: 'Someone who drove teams for a living might have known how to get a loaded wagon down that grade.',
  },
  {
    day: 3,
    title: 'Mono Lake',
    answers: [
      { neighbor: 'Wing Yee', line: 'Wing led us to a spring on the east shore. The water was sweet.' },
      {
        neighbor: 'James Stuart Cain',
        line: 'Mr. Cain knew the shore from his barges and led us to a spring. The water was sweet.',
      },
      {
        item: 'Chart of the Mono Lake shore',
        line: "Mr. Cain's chart showed a spring on the east shore. The water was sweet.",
      },
    ],
    failure:
      "The lake is too bitter to drink, and we couldn't find fresh water. A long, dry day for us and the mules.",
    hint: 'Someone who knew the shore, or had a map of it, might have found a spring.',
  },
  {
    day: 5,
    title: 'The pines',
    answers: [
      {
        neighbor: 'Wing Yee',
        line: 'Wing had the first tree down before we had the wagons unhitched. By dark we had three cords split and stacked. My hands have never hurt like this.',
      },
      {
        item: 'Two-person crosscut saw',
        line: 'The big crosscut saw sang all day. By dark we had three cords split and stacked. My hands have never hurt like this.',
      },
    ],
    failure: 'We had the wrong saw, or the wrong hands. Two days of work for one cord.',
    hint: 'A real woodcutter, or a proper saw, would have made the difference.',
  },
  {
    day: 7,
    title: 'Whiteout',
    answers: [
      {
        neighbor: 'Annie Donnelly',
        line: 'Annie went ahead on her skis and found the road.',
      },
      {
        neighbor: 'Andrew Cameron',
        line: 'Andrew had us dig in behind the wagons the way they did in the Sierra camps. We waited it out.',
      },
      {
        neighbor: 'Pete Sturgeon',
        line: "Pete stopped the wagons, read the wind, and found the road where none of us could see one. He didn't explain how.",
      },
      { item: 'Long snowshoes', line: "Annie's skis carried one of us ahead to find the road." },
    ],
    failure: "We couldn't see the mules from the wagon. We walked in circles until morning.",
    hint: 'Someone who knew the high country in winter, or a way across deep snow, might have found the road.',
  },
  {
    day: 9,
    title: 'The axle',
    answers: [
      {
        neighbor: 'Ruth Hartley',
        line: 'The axle cracked at twenty below. Ruth had it off and the spare on before the light went.',
      },
      {
        item: 'Iron-shod spare axle',
        line: "The axle cracked at twenty below. We'd never have made it without Mr. Boone's spare. It took four of us and most of the afternoon.",
      },
    ],
    failure: 'The axle cracked at twenty below. We left the second wagon and its wood on the road. I still think about that wood.',
    hint: 'Someone who could fix a wagon on the road, or a spare part, would have saved it.',
  },
  {
    day: 11,
    title: 'Frostbite',
    answers: [
      {
        neighbor: 'Hannah Price',
        line: "Hannah took one look at my fingers and wouldn't let anyone hold them to the fire. She thawed them slowly, the way she'd learned in Virginia City. I'll keep all ten.",
      },
    ],
    failure: "My fingers went white, then gray. I'll keep the hand, they think.",
    hint: 'Someone with nursing experience would have known how to thaw them.',
  },
]

export const CHALLENGE_COUNT = CHALLENGES.length

const QUIET_DAYS: { day: number; line: string }[] = [
  { day: 2, line: 'First night out. Someone asked why I came west. I said gold. They laughed, but kindly.' },
  {
    day: 4,
    line: "The lake is the strangest thing I've ever seen: water so bitter no fish can live in it, and birds everywhere anyway.",
  },
  { day: 6, line: "Snow overnight. Nobody wants to say what we're all thinking about the trip home." },
  { day: 8, line: 'Loaded wagons, uphill. Two miles today. Maybe three.' },
  { day: 10, line: 'Everyone smells of smoke and mules. Nobody minds anymore.' },
]

export type JournalDay = {
  day: number
  title: string | null
  lines: string[]
  succeeded: boolean | null
  hint: string | null
}

export type Outcome = 'clean' | 'worse_for_wear' | 'failed'

export type ExpeditionResult = {
  journal: JournalDay[]
  failures: number
  outcome: Outcome
  arrival: string
  wingCame: boolean
}

export function runExpedition(party: string[], items: string[]): ExpeditionResult {
  const contributed = new Set<string>()
  const challengeDays: JournalDay[] = CHALLENGES.map((challenge) => {
    const answer = challenge.answers.find((a) =>
      a.neighbor ? party.includes(a.neighbor) : items.includes(a.item!)
    )
    if (answer) contributed.add((answer.neighbor ?? answer.item)!)
    return {
      day: challenge.day,
      title: challenge.title,
      lines: [answer ? answer.line : challenge.failure],
      succeeded: answer !== undefined,
      hint: answer ? null : challenge.hint,
    }
  })

  // Everyone in the party gets a moment on a quiet day: first those who didn't save a challenge
  // (people and things), then those who did. Items that helped are left out, since their color
  // lines assume they weren't needed.
  const partyNeighbors = NEIGHBORS.filter((n) => party.includes(n.name))
  const colorLines = [
    ...partyNeighbors.filter((n) => !contributed.has(n.name)).map((n) => n.colorLine),
    ...items.filter((item) => !contributed.has(item)).map(itemColorLine),
    ...partyNeighbors.filter((n) => contributed.has(n.name)).map((n) => n.colorLine),
  ]
  const quietDays: JournalDay[] = QUIET_DAYS.map(({ day, line }, index) => ({
    day,
    title: null,
    lines: colorLines[index] ? [line, colorLines[index]] : [line],
    succeeded: null,
    hint: null,
  }))

  const failed = (title: string) => challengeDays.some((d) => d.title === title && !d.succeeded)
  const failures = challengeDays.filter((d) => !d.succeeded).length
  const outcome: Outcome = failures <= 1 ? 'clean' : failures === 2 ? 'worse_for_wear' : 'failed'
  return {
    journal: [...challengeDays, ...quietDays].sort((a, b) => a.day - b.day),
    failures,
    outcome,
    arrival: arrivalLine(outcome, { lostAWagon: failed('The axle'), thinLoads: failed('The pines') }),
    wingCame: party.includes('Wing Yee'),
  }
}

function arrivalLine(outcome: Outcome, { lostAWagon, thinLoads }: { lostAWagon: boolean; thinLoads: boolean }) {
  if (outcome === 'failed') {
    return 'We came home with almost nothing. Bodie buried more of its own that winter than it should have.'
  }
  if (outcome === 'worse_for_wear') return 'We came home with less than we went for, and less of ourselves.'
  if (lostAWagon) return 'We came down into Bodie on the twelfth day with one wagon of pine. The other is still on the road.'
  if (thinLoads) return 'We came down into Bodie on the twelfth day with the wagons half full. It would have to do.'
  return 'We came down into Bodie on the twelfth day with both wagons full of pine.'
}
