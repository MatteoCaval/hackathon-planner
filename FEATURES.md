# Feature Ideas

Track feature ideas for the Hackathon Planner. Add ideas below and Claude Code will help expand and implement them.

**Status legend:** `[ ]` planned · `[~]` in progress · `[x]` completed

---

## Ideas

<!-- Add feature ideas here. Example:
- [ ] **Dark mode** - Add a dark theme toggle to the navbar
- [ ] **Multi-currency support** - Allow budgets in currencies other than EUR
-->


- [x] for flights optionally add the option of adding arrival and departure time
- [x] for flight add the option to add start destination (Dublin by default)
- [x] for both flights and accommodation I would like to be able to group by date range, so that I can then keep adding inside that group without having to repeat the dates every time
- [x] I would like to be able to add easy link to jump in the booking page for that date range and accommodation (to make easier to search new places)
- [x] Customizable search links - configure booking providers (label, URL template, type) via settings gear icon. Defaults: Google Flights, Ryanair, Booking.com, Airbnb
- [x] Group by dates enabled by default in both flight and accommodation managers
- [x] "Add another" scrolls to and focuses the quick-add form with dates pre-filled
- [x] UI/UX review: responsive quick-add grid, touch-friendly action buttons, reduced-motion support, font preloading, aria-labels, removed duplicate Leaflet CSS, fixed mobile viewport units
- [x] voting systems: as you can see all of this is for a team to go somewhere in a retreat, we need to accomodate everyone's needs. we want to persist these votes in firebase togetehr with the trip
	- [x] a way of impersonify a person, somewhere maybe in the top having a list of people a choose the one to impersonate (it's all based on trust) and if your name is missing from the list you can add it
	- [x] once the person is chose, we want to be able to add/remove vote in every kind of option (flight, acoommodation, destination)
	- [x] we then need to be able to then review the votes somehow
- [x] Real-time sync: replaced manual push/pull with automatic Firebase sync. Enter a trip code and click Join — all changes (destinations, settings, votes, members) sync live across all connected browsers. Join modal warns before overriding local data with remote.
- [x] Accommodation search links include `{people}` placeholder — Booking.com and Airbnb links auto-fill the team's people count
- [x] add search accomodation in the stay too, it's very common to search accommodation after having found a good flight option
- [x] when adding a new accommodation, suggest date range already of the flights (don't consider the one already added, cause in that case I can add them from the bottom)