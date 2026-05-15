# Matt Pocock — Workflow for AI Coding

Samenvatting van de YouTube-walkthrough (`https://youtu.be/-QFHIoCo-Ko`). In eigen woorden, in de volgorde waarin de concepten op elkaar bouwen — niet strikt in videovolgorde. Tijdstempels tussen haakjes verwijzen naar de bron.

---

## 1. Smart zone vs. dumb zone (03:02)

Een LLM begint elke sessie "scherp": korte context, hoge focus, weinig afleiders. Naarmate er meer tokens in de context schuiven, neemt de kwaliteit van het denken kwadratisch af — niet lineair. Pocock leent het beeld van Dex Hy: het is alsof je teams aan een voetbalcompetitie toevoegt. Elk extra team voegt niet één wedstrijd toe, maar wedstrijden tegen *alle* andere teams. Dezelfde combinatorische groei geldt voor relaties tussen tokens.

Praktisch gevolg: **houd taken klein**. Wat in de smart zone in een paar minuten lukt, kost in de dumb zone uren en gaat alsnog mis. Dit is dezelfde regel die Martin Fowler in "Refactoring" hanteert — kleine commits zijn niet een esthetische voorkeur, ze houden het denkwerk binnen iemands smart zone (mens én model).

## 2. Memento-analogie (07:16)

Elke nieuwe sessie is een tabula rasa, zoals het hoofdpersonage in *Memento* zijn geheugen reset. De LLM weet niets van wat je gisteren samen deed. Vier fases die elke sessie doorloopt:

1. **System prompt** — de identiteit en regels
2. **Exploration** — context vergaren over de codebase / het probleem
3. **Implementation** — schrijven van code
4. **Tests** — verificatie

Omdat geheugen niet meekomt, moet alles wat behouden moet blijven *opgeschreven* zijn: PRDs, tickets, ADRs. Niet in chat-historie. Mondelinge afspraken bestaan niet voor de volgende sessie.

## 3. Clear vs. compact context (08:00)

Twee manieren om een lange sessie op te ruimen:

- **Clear** — gooi alle context weg, terug naar system prompt. Schone start, geen ruis.
- **Compact** — vat de sessie samen en hervat met die samenvatting als nieuwe context.

Pocock geeft de voorkeur aan **clear**. Een gecompacte samenvatting bevat onvermijdelijk vertaalfouten en irrelevante details die het model alsnog uit de smart zone duwen. Beter: maak je werk zo gedocumenteerd dat clearen geen verlies is — de PRD en de tickets bevatten alles wat het model moet weten om opnieuw te beginnen.

## 4. "Grill me" skill (12:04)

Het centrale risico bij AI-gestuurd werken is dat het model *denkt* te weten wat je wilt maar er net naast zit. Fred Brooks: software bouwen is in essentie het bouwen van een *shared design concept* tussen mensen. Met een LLM is die "shared" niet vanzelfsprekend.

Oplossing: dwing het model om **jou** te interviewen voordat er code geschreven wordt. Een sessie kan oplopen tot 80 vragen. Het doel is niet "snel klaar zijn" maar onuitgesproken aannames boven tafel krijgen — over edge cases, scope, prioriteiten, niet-doelen. De output van zo'n grilling is grondstof voor het PRD.

Bruikbaar input voor grilling: meeting-transcripten, oude PRDs, klantgesprekken. Het model leest, jij beantwoordt vragen die het stelt.

## 5. Sub-agents (17:35)

Niet elke verkenning hoeft in de hoofdcontext. Voor exploratieve taken ("waar wordt X gebruikt", "welke bestanden raken Y") delegeer je naar een sub-agent met eigen context. De sub-agent doet zijn werk, geeft een korte samenvatting terug, en zijn ruwe tokens vervuilen jouw smart zone niet.

Dit verschuift het probleem niet, het scheidt het: de hoofdcontext blijft schoon en gefocust op de taak, de sub-agent mag zoveel rommel binnenkrijgen als nodig.

## 6. PRD als destination document (06:31, 25:41)

Het Product Requirements Document is **niet** een ticket. Het is een eindbestemming: waar willen we uitkomen. Vaste secties:

- **Problem statement** — wat is er nu mis / wat ontbreekt
- **Solution** — op conceptniveau, niet op code-niveau
- **User stories** — wie doet wat, waarom
- **Implementation decisions** — keuzes die vastliggen (stack, patterns)
- **Testing strategy** — hoe weten we dat het klopt
- **Out-of-scope / negative decisions** — wat we expliciet *niet* doen

Die laatste sectie is geen formaliteit. Negative decisions voorkomen scope creep en zijn een lakmoesproef voor of het PRD-werk grondig is. Een PRD zonder out-of-scope is bijna altijd te vaag.

## 7. Kanban board met tickets (40:12)

Het PRD beschrijft de bestemming; de tickets beschrijven de reis. Elke ticket is een markdown-file met:

- ID + titel
- Dependencies (expliciet — niet impliciet via volgorde)
- Type: human-in-the-loop of AFK
- Acceptance criteria
- Test-strategie (red-green-refactor outline)
- Fase (om DAG-parallellisatie mogelijk te maken)

Markdown-files op disk, niet een SaaS-board. Reden: het model kan ze lezen en updaten. Een Jira-ticket kan dat niet zonder MCP-gymnastiek.

## 8. Vertical slices / tracer bullets (42:09)

Horizontale planning ("eerst alle database-tabellen, dan alle API endpoints, dan alle UI") is **fout** voor AI-gestuurd werk. Reden: je hebt pas na honderden uren een werkend systeem om feedback op te krijgen. In die honderden uren zijn aannames stilletjes verkeerd gegaan.

Een **vertical slice** snijdt door alle lagen tegelijk: db-schema voor één entiteit, één endpoint, één UI-component, één test. Klein, lelijk, maar werkend en zichtbaar. De analogie is een lichtspoorpatroon uit luchtafweergeschut: je ziet meteen of je raak schiet. Eerste slice móet door alle lagen gaan.

## 9. DAG van issues (49:23)

Tickets zijn knopen, dependencies zijn pijlen → directed acyclic graph. Door het ticketlandschap als DAG te modelleren wordt zichtbaar wat parallel kan en wat moet wachten.

Pocock werkt typisch met drie fases. Binnen elke fase kunnen meerdere agents (of mensen) parallel werken; tussen fases zit een synchronisatiepunt. Geen abstracte planning — een concrete graaf die je ook fysiek in een diagram kan tekenen.

## 10. Human-in-the-loop vs. AFK (25:41)

Niet elke taak hoort autonoom gedaan te worden. Twee categorieën:

- **Human-in-the-loop** — planning, PRD-schrijven, architecturale keuzes, manuele QA, smaakoordelen. Mens is essentieel; AI is assistent.
- **AFK (Away From Keyboard)** — uitgewerkte tickets met scherpe acceptance criteria en niet-cheatbare tests. Mens hoeft er niet bij te zitten; agent draait door.

Het label "AFK" op een ticket plakken is een commitment: het *moet* dan ook echt los kunnen lopen. Slappe AFK-tickets vergiftigen de loop.

## 11. Ralph-loop (52:54)

Genoemd naar Ralph Wiggum ("incremental adjustments toward the goal"). Mechanisme:

- Bash-script in een Docker-container met de stack + Claude Code CLI
- Script leest open tickets uit `docs/kanban/*.md`
- Filtert op prio (bugs > infra > features)
- Per ticket: agent leest → schrijft failing test → implementeert → test groen → commit
- Logs per run naar `runs/<timestamp>/`

Sandboxed in Docker zodat:
- Geen vervuiling van je host machine
- Veilig om destructieve commando's toe te staan
- Reproduceerbaar — anderen kunnen dezelfde container draaien

Start sequentieel. Parallel pas wanneer de loop stabiel is. Geen exotische agent-frameworks — gewoon bash + CLI. Transparant en debugbaar.

## 12. TDD red-green-refactor met niet-cheatbare tests (06:33, 07:31)

Klassieke cyclus:
1. **Red** — schrijf een test die faalt
2. **Green** — schrijf de minimale code die hem doet slagen
3. **Refactor** — ruim op zonder de test te breken

Voor AI-werk is dit dwingender dan voor menselijk werk. Een goed gedefinieerde failing test:
- Maakt de acceptatiecriteria mechanisch verifieerbaar
- Geeft de agent een concrete win-conditie
- Voorkomt "het lijkt te werken" zonder bewijs

Belangrijk: **tests moeten niet te bedotten zijn**. Agents proberen soms tests te bypassen (mock-overdrijving, assertions slopen, `expect(true).toBe(true)`). Tegenmaatregelen:
- Tests via een runner die de agent niet rechtstreeks kan editen vlak voor het commit-moment
- Test-naam + implementatie zichtbaar in CI-logs
- Reviewer (eventueel een tweede agent met Opus) controleert de test-veranderingen specifiek

Goede feedback-loops (snelle, niet-cheatbare tests) zijn de single grootste hefboom op AI-output kwaliteit.

## 13. Push vs. pull standards (27:41)

Coding standards kun je op twee manieren aan een agent doorgeven:

- **Push** — alle regels in de system prompt / een grote CLAUDE.md die altijd geladen is. Werkt, maar vult de context.
- **Pull** — regels staan in losse bestanden; agent leest ze pas als ze relevant zijn ("voor TypeScript-styling, lees `docs/ts-style.md`").

Pocock's nuance: **pull voor implementatie, push voor review**. Tijdens schrijven moet de agent niet door 2000 regels stylegids hoeven — pull on demand. Tijdens een review-pass wil je dat de standards aan staan zodat er consistent op gechecked wordt — push.

## 14. Deep modules vs. shallow modules (Ousterhout) (01:14:22)

Uit *A Philosophy of Software Design*:

- **Shallow module** — kleine interface, dunne implementatie. Veel kleine bestanden met complexe onderlinge afhankelijkheden. Hoge kans dat een agent (of mens) verdwaalt.
- **Deep module** — kleine interface, dikke implementatie. Veel functionaliteit verstopt achter een simpele API. Makkelijk te testen want de testboundary is duidelijk.

Voor AI-werk is dit cruciaal: een deep module past in de smart zone (interface + intent passen op één scherm), terwijl een diepte van shallow modules de agent dwingt om bestand 17 te openen om te begrijpen wat in bestand 3 gebeurt. Architectuur-skill: **identificeer plekken waar modules dieper moeten worden**.

## 15. Doc rot (01:23:20)

Documenten zijn alleen waardevol zolang ze kloppen. Een verouderd PRD is gevaarlijker dan geen PRD — het misleidt mens én agent. Regel:

- Tijdens het werk: doc bijwerken bij elke afwijking
- Na afloop: doc verwijderen als hij niet meer over de werkelijkheid gaat

Migrations zijn een uitzondering (ze beschrijven historische veranderingen, geen huidige staat). Voor PRDs en design docs geldt: **liever weg dan rot**.

## 16. Manual QA (01:12:38)

Tegen het einde van het werk: zet alles aan, klik door de app, voel of het deugt. Geen test vangt smaak — kleur-afwijking, animatie-haperingen, copy die net niet klopt, intuïtieve fricties. Pocock: "manual QA imposes personal taste."

De verleiding bij AI-workflows is om elk fragment van het werk te automatiseren. Niet doen. Manual QA is waar de mens het kwaliteitsoordeel uitoefent dat verder volledig aan agents is overgelaten. Skip dit en je krijgt een app zonder ziel.

---

## Samenhang

De zestien concepten zijn geen losse tips, ze hangen samen rond één principe: **menselijk denken concentreert zich op planning en oordeel; agents leveren executie binnen scherpe randvoorwaarden**.

- Smart zone, Memento, clear context → houd de cognitieve last laag, zowel bij jezelf als bij het model
- Grill me, PRD, kanban, vertical slices, DAG → mens denkt vooraf zorgvuldig na (push back tegen elk PRD zonder out-of-scope, elke eerste slice die horizontaal is)
- Ralph-loop, TDD, push/pull, deep modules → randvoorwaarden waarbinnen agents autonoom kunnen draaien
- Doc rot, manual QA → oordeels-skill blijft bij de mens

De workflow faalt als één pijler ontbreekt: een goed PRD zonder TDD geeft cheating; TDD zonder vertical slices geeft "alle backend klaar, frontend nooit"; een ralph-loop zonder deep modules geeft eindeloze context-tickets.
