# Application Information

Repository for AdaHack 2026 - Our Patch.

[Video Demo](/demo/DEMO%20Video.mp4)

[Slides](/demo/AdaHack%20-%20Our%20Patch.pdf)

[Devpost](https://devpost.com/software/ourpatch-grow-your-street-together)

## Inspiration
At Postcode Lottery you don't play on your own. You play with the neighbours who share your postcode. We wanted keeping a street green to work the same way. Residents see climate change as an urgent problem, but one person's effort can feel too small to matter. Our Patch makes that effort visible and shared.

## What it does
Our Patch is a community game where every postcode is a house on a shared map.

- **Green Score:** each postcode is coloured green, yellow or red. Live air quality and electricity data set the starting point, and community actions move it.
- **Challenges:** neighbours complete tasks such as Short Hop, Car-Free Day, Charity Drop, Plant a Pot, Litter Pick, Helping Hand, Borrow Don't Buy and Second-Hand Find.
- **GreenHour:** a daily bonus window that neighbours join with one tap, with a counter showing how many are in.
- **Postcode streak:** complete tasks daily to keep it alive.
- **Leaderboard:** points add up for your community.
- **Trees:** your street grows trees as it improves.
- **Privacy:** every street's colour is public, but its stats are private.

## UN Sustainable Development Goals
Every challenge is designed around a UN goal: Zero hunger (2), good health and wellbeing (3), affordable and clean energy (7), reduced inequalities (10), sustainable cities and communities (11), responsible consumption and production (12), climate action (13) and life on land (15), partnerships for the goals (17)

## How we built it
- A Python API backend and a web front end with an interactive map
- postcodes.io to turn postcodes into locations
- Open-Meteo for air quality
- The Carbon Intensity API for local electricity
- OpenStreetMap for the map and green space
- Our own pixel-art houses and trees, drawn to give the app a homely feel

## How we worked
We split the project into code, research, development, asset creation, task design and UN goal alignment. Each of us led the strand that suited us, and nobody stayed in one lane. Everyone wrote some code, and we all helped with bug fixes and API connections. We kept short feedback loops all day, reviewing each other's work as we went.

## Challenges we ran into
- Air quality and electricity data are regional, so they are the same across neighbouring postcodes. We made community action the thing that sets streets apart.
- The energy certificate data we planned to use covers England and Wales only, so we dropped it.
- Connecting several APIs and fixing bugs within a single day.

## Accomplishments that we're proud of
- A working map with live data, challenges, streaks and a leaderboard, built in one day
- A look and feel that is our own
- Every team member contributed code

## What's next for Our Patch
- Full integration with Postcode Lottery accounts
- Fair scoring, so every street is judged on how far it moves from its own starting point
- Community chats for ride sharing, borrowing and chores, with privacy safeguards
- Action verification by QR code or receipt
- Historical restoration tasks and a local food partnership