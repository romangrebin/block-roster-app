import Link from 'next/link'
import { notFound } from 'next/navigation'
import { EXPEDITION_BLOCK_CODE } from '@/lib/expedition'
import PageContainer from '@/components/PageContainer'
import MarkdownText from '@/components/MarkdownText'

const SOURCES = `
## The town

- Bodie began with a gold discovery in 1859 (W.S. Bodey). Peak population estimates around 1879–80 range from about 2,700 (the 1880 census) to 7,000–10,000 (local accounts); sources vary widely. — [bodiehistory.com](https://bodiehistory.com/bodie2.htm), [Legends of America](https://www.legendsofamerica.com/ca-bodie/2/)
- The decline began in 1880–81 as the richest ore ran out and mining companies went bankrupt. Miners left for new booms in Tombstone, Butte, and Utah. About 1,500 people remained in 1886; the census counted 90 in 1940. — [California State Parks: Bodie SHP](https://www.parks.ca.gov/pages/509/files/BodieSHP2010.pdf), [Legends of America](https://www.legendsofamerica.com/ca-bodie/2/), [Abandoned Places wiki](https://abandonedplaces.fandom.com/wiki/Bodie,_California)
- ★ Many houses still hold their original furnishings: stoves, dishes, food tins in the cupboards. They survived partly because J.S. Cain bought up buildings as people left, and his family kept caretakers on site for decades. — [TakeMyTrip](https://takemytrip.com/2016/02/bodie-americas-best-preserved-ghost-town/), [Tarnmoor](https://tarnmoor.com/2019/07/30/)
- ★ At about 8,375 feet with no local timber, Bodie suffered a real **"wood famine" in 1878–79**: a cord of firewood cost $18–20. — [destination4x4: Sawmill](https://www.destination4x4.com/sawmill-bodie-california-mono-county/)
- ★ The fix was a railroad: the Bodie Railway & Lumber Co. opened a 31.7-mile narrow-gauge line to Mono Mills in November 1881, hauling wood until 1917. — [Wikipedia: Bodie and Benton Railway](https://en.wikipedia.org/wiki/Bodie_and_Benton_Railway_and_Commercial_Company), [nvexpeditions](https://beyond.nvexpeditions.com/california/mono/bodie.php)
- ★ The world's largest stand of Jeffrey pine grows southeast of Mono Lake, which is where Bodie's wood came from. — [Atlas Obscura: Mono Mills](https://atlasobscura.com/places/mono-mills)
- Cyanide processing (1890) revived the Standard mine. It closed in 1913, a 1932 fire destroyed most of Main Street, and Bodie became a state park in 1962, kept in "arrested decay." — [bodiehistory.com](https://bodiehistory.com/bodie2.htm)
- **A liberty we took:** in the game the Methodist Church already stands in the winter of 1879. It was really completed in 1882, and before that the congregation met in homes and the Miners' Union Hall. Its bell was first rung on Christmas Day, 1882. — [bodie.com](https://www.bodie.com/history/structures/methodist-church/)
- ★ The Methodist Church is the town's last standing church. Its painted Ten Commandments cloth was stolen by vandals sometime between the 1940s and 1962. — [bodie.com](https://www.bodie.com/history/structures/methodist-church/)

## The people

- **Documented** (name and household from the record; voices and skills imagined): James Stuart Cain, Ella Cody Cain (wife of David Victor Cain), Theresa Seiler (wife of saloonkeeper August Seiler), Tom Miller (teamster), Andrew Cameron (miner), Dan McDonald (Standard mine), Annie Donnelly (born Annie Pagdin, wife of Charlie Donnelly), Harvey Boone (general store). — [Wikipedia: List of buildings in Bodie](https://en.wikipedia.org/wiki/List_of_buildings_in_Bodie,_California)
- ★ J.S. Cain ran lumber barges on Mono Lake, became Bodie's banker, and his family came to own most of the town, which is part of why so much of it survived. — [bodie.com: Cain home](https://www.bodie.com/history/structures/james-stuart-cains-home/)
- **Invented** for 1879 (the houses' documented families came later, or no record exists): Hannah Price (L.E. Bell House; Lester Bell later ran the cyanide plant), Clara Holt (a nod to real schoolteacher Alice Dolan, 1935–37), Josiah Webb, Ruth Hartley (Red Barn), Pete Sturgeon (no record of a Sturgeon House was found), Wing Yee (built from the history below).
- **A liberty we took:** a winter wood expedition with women in the party would have been unusual in 1879. Frontier women did plenty of hard physical work, though, and Bodie's women ran saloons, boarding houses, laundries, and businesses.

## The hazards and tools

- ★ In 1879, rubbing frostbite with snow was standard medical advice, following Napoleon's surgeon Larrey (1812), and it stayed that way into the 20th century. Larrey did warn against thawing by an open fire. Today, rapid rewarming in warm water is the treatment. — [WEM historical essay](https://read.qxmd.com/read/27816378/dull-brains-and-frozen-feet-a-historical-essay-on-cold), [PMC](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10190748/)
- ★ Gold-rush Californians called skis **"snowshoes."** "Snowshoe" Thompson carried mail over the Sierra on ten-foot skis with a single pole from 1856 to 1876. — [Wikipedia: Snowshoe Thompson](https://en.wikipedia.org/wiki/Snowshoe_Thompson), [American Heritage](https://americanheritage.com/when-forty-niners-went-sixty)
- ★ Mono Lake has no outlet: water leaves only by evaporation, so salts build up. It's two to three times saltier than the ocean and strongly alkaline, and no fish live in it, though trillions of brine shrimp do. — [Atmos: The Strange, Salty Power of Mono Lake](https://atmos.earth/the-strange-salty-power-of-californias-mono-lake/)

## The land and its communities

- ★ The Bodie Hills are the homeland of the Kutzadika'a (Mono Lake Paiute). Their name refers to the brine fly pupae they harvested at the lake. The rush disrupted their camps and pinyon groves, and they are still here, still seeking federal recognition. — [Wikipedia: Mono people](https://en.wikipedia.org/wiki/Mono_people), [Forgotten Lands](https://forgottenlands.substack.com/p/dispatch-16-the-bodie-hills), [ICT News](https://ictnews.org/?p=125852)
- ★ Bodie's Chinese residents settled along King Street by the 1870s. Barred from the mines, they came to dominate woodcutting, hauling cordwood by mule train, so much of Bodie's warmth came through their hands. — [Nevada State Museum: Fueling the Boom](https://carsonnvmuseum.org/exhibits/fueling-the-boom-chinese-woodcutters-in-the-great-basin-1870-1920), [Carson Now](https://carsonnow.org/reader-content/06/25/2019/lecture-details-lives-immigrant-chinese-woodcutters)
- The 1882 Chinese Exclusion Act was passed during this era.

## Visit

- [Bodie State Historic Park](https://www.parks.ca.gov/Bodie): self-guided brochure, history talks, stamp-mill tours
- [Bodie Foundation](https://www.bodiefoundation.org/): preservation, private tours, ghost walks
`

export default async function ExpeditionSourcesPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  if (code !== EXPEDITION_BLOCK_CODE) notFound()

  return (
    <PageContainer className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-3xl font-semibold text-ink">The history behind the story</h1>
      <p className="text-lg text-muted">
        Every fact in the Expedition, with its source. ★ marks the surprising ones.
      </p>
      <MarkdownText
        text={SOURCES}
        className="text-base text-ink [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-8 [&_li]:mt-2"
      />
      <p className="text-base">
        <Link href={`/${code}`} className="text-accent underline">
          Back to Bodie
        </Link>
      </p>
    </PageContainer>
  )
}
