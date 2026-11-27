# 02 · Ports and flags

Files: `web/js/data/ports.js` (`FLAGS`, `PORTS`, `PORT_IDS`), `web/js/data/sanctions.js`,
`web/js/sim/incidents.js` (strict / image flags), `web/js/sim/home.js` (perk lists).

## Port fields (`PORTS[id]`)

| Field | Meaning | Read by |
|---|---|---|
| `flag` | country code → `FLAGS` | everything country-related (home flag, embargo, customs, corruption, strict inspections, bans) |
| `size` 1–5 | market depth, handling speed (`size^0.8`), contract counts, finance profile (≥ 4 = established), prospecting odds, production | economy, contracts, trade |
| `draft`, `deep{hold:m}` | max draft; deeper terminals per hold (oil buoys, ore quays) | `portDraft`, `fitsPort`, `servesType` |
| `terminals[]` | holds the port can load/unload | `portHandles`, contracts, trade, used market |
| `fuel` | × world fuel price | `fuelPrice` |
| `repair` 0–3 | 0 none, 1 simple (max 70 %, ×1.25 cost), 2 full (×1.0), 3 big yard (×0.85, faster) | `repairCost`, equipment install, detention repair, AI |
| `fees` | × port fee `(5000 + gt) × fees` | `portFee` (paid on every arrival) |
| `exp{good:w}`, `imp{good:w}` | export / import intensity 0–1 | prices (`role`), production/stock, contract origin/destination weights, tenders, prospecting |
| `ice{open, close, spread}` | seasonal port (day of year of thaw / freeze ± spread) | `sim/ice.js` |
| `blurb` | text on the home-port picker | UI |
| `lat`, `lon` | map, storms, piracy/patrol/pollution zones, disasters | routing, events |

Port ids used as yards (`YARDS` in `actions.js`): shanghai 0.92 × 80 d, busan 0.95 × 75 d,
yokohama 1.0 × 80 d, singapour 1.03 × 90 d, dubai 1.05 × 90 d, rotterdam 1.12 × 100 d.

## Flag fields (`FLAGS[code]`)

`tax` (on positive monthly profit), `crew` (× wages), `subsidy` (off new-build price), `rating`
(registry quality → starting trust/virtue = `rating×0.5+25`, customs level, corruption), `rate`
(bank interest base). A company's flag = its home port's flag (changes on relocation or forced
expulsion, see [03](03-home-ports.md)).

Derived from `rating` (`data/sanctions.js`):
- `customsLevel(flag)`: rating ≥ 75 → 0.35, ≥ 55 → 0.22, ≥ 40 → 0.14, else 0.08 (parcel search odds base).
- `corruption(flag)`: `clamp((70 − rating)/60, 0, 0.85)`; > 0.15 = bribe possible, corrupt officials purchasable.

## Country lists

| List | Members | Effect |
|---|---|---|
| `EMBARGOED` (sanctions.js) | IR, VE, RU, KP | taint ships (365 d), thin markets (depth ×0.15), price factor (imports ×1.08, exports ×0.95), freight ×1.25 (`EMBARGO_PREMIUM`), no tenders, finance profile `embargo`, dark jobs (if also shady), shadow lender for home companies, oil contracts survive the refinery crisis |
| `ENFORCING` | US, CA, NL, DE, FR, IT, ES, PL, RO, GR, JP, KR, AU, NZ | sanctions fine on tainted ships (35 %), coastguard patrols 200 nm around their ports, closed to blacklisted companies, enforcing-flag companies pay full fine and AI avoids embargo |
| `SHADY_PORTS` | colon, cartagena, puerto_la_cruz, lagos, tema, abidjan, luanda, djibouti, bandar_abbas, karachi, mombasa, manille, veracruz, alexandrie, nampo, es_sider, chittagong, novorossiysk | parcel offers, more spontaneous parcel proposals (35 %), cargo-loan profile `louche`, plots can be ordered from there, blacklisted companies ignore reputation there |
| dark ports = embargoed ∩ shady | bandar_abbas, puerto_la_cruz, novorossiysk, nampo | gangs' trust, dark jobs, grudges; = the 4 shadow home ports |
| `STRICT_FLAGS` (incidents.js) | NL, DE, FR, GR, US, CA, JP, AU, KR, SG | high inspection odds on worn ships |
| `IMAGE_PORT_FLAGS` | NL, DE, FR, CA, AU, SG, JP | inspection odds × (1.3 at virtue 0 … 0.6 at 100) |
| pollution `ZONES` (data/zones.js) | 18 sensitive coasts (real outlines) with cost factor 1.5–5 and a flag | spill cost, port ban for negligent polluter |
| piracy zones (piracy.js) | aden, guinee (strong), malacca, sulu (medium), venezuela (weak) | attacks |

## The 66 ports

Terminal letters: V vrac, L liquide, D divers, C conteneurs, Ch chimique, G gpl, N gnl, Ve vehicules,
F frigo, H lourd (heavy lift). Deep terminals in brackets.

| id | Name | Flag | Size | Draft (deep) | Repair | Fuel | Fees | Terminals | Tags |
|---|---|---|---|---|---|---|---|---|---|
| rotterdam | Rotterdam | NL | 5 | 24 | 3 | 0.97 | 1.15 | VLDCChGNVeFH | financial hub, enforcing |
| hambourg | Hambourg | DE | 4 | 15.1 | 2 | 1 | 1.1 | VLDCChVeFH | winter, enforcing |
| le_havre | Le Havre | FR | 4 | 16 (L22) | 2 | 1.02 | 1.05 | VLDCChGVeFH | enforcing |
| marseille | Marseille | FR | 3 | 14.5 (L22) | 2 | 1.03 | 1 | VLDCChGNVeF | enforcing |
| piree | Le Pirée | GR | 4 | 18 | 2 | 0.96 | 0.9 | VLDCChGNVeF | enforcing |
| alexandrie | Alexandrie | EG | 3 | 12 (L18) | 1 | 0.92 | 0.8 | VLDCChGVeFH | shady |
| djeddah | Djeddah | SA | 4 | 16 (L18) | 1 | 0.85 | 0.9 | VLDCChGVeFH |  |
| ras_tanura | Ras Tanura | SA | 4 | 25 | 0 | 0.8 | 0.85 | LG |  |
| dubai | Dubaï | AE | 5 | 17 (L20) | 3 | 0.86 | 0.95 | VLDCChGNVeFH | financial hub |
| mumbai | Mumbai | IN | 4 | 14 (L24.5) | 2 | 0.95 | 0.85 | VLDCChGNVeFH |  |
| singapour | Singapour | SG | 5 | 23 (L24.5) | 3 | 0.9 | 0.95 | VLDCChGNVeFH | financial hub |
| shanghai | Shanghai | CN | 5 | 17 (V22.5 L24.5) | 3 | 0.94 | 0.9 | VLDCChGNVeFH | financial hub |
| busan | Busan | KR | 4 | 17 (V20 L24.5) | 3 | 0.95 | 0.95 | VLDCChGNVeFH | enforcing |
| yokohama | Yokohama | JP | 4 | 16 (V20 L24.5) | 3 | 1.02 | 1.15 | VLDCChGNVeFH | enforcing |
| port_hedland | Port Hedland | AU | 4 | 19.5 | 0 | 1.1 | 1 | V | enforcing |
| sydney | Sydney | AU | 3 | 14 (V18.5) | 2 | 1.08 | 1.1 | VLDCChVeFH | enforcing |
| durban | Durban | ZA | 3 | 12.8 (L17) | 2 | 0.98 | 0.9 | VLDCChVeFH | family first |
| lagos | Lagos | NG | 3 | 13.5 (L22) | 1 | 1.05 | 1.1 | VLDCChGNVeFH | family first, shady |
| abidjan | Abidjan | CI | 2 | 13 | 1 | 1.04 | 0.95 | VLDCChVeFH | shady |
| santos | Santos | BR | 4 | 15 | 2 | 1 | 1 | VLDCChGVeFH |  |
| buenos_aires | Buenos Aires | AR | 3 | 10 | 1 | 1.05 | 0.95 | VLDCChVeFH | family first |
| colon | Colón | PA | 3 | 15 | 2 | 0.93 | 0.85 | VLDCChVeFH | shady |
| new_york | New York | US | 5 | 15.2 | 2 | 1.04 | 1.2 | VLDCChGVeFH | financial hub, enforcing |
| houston | Houston | US | 5 | 14 (L25) | 2 | 0.92 | 1.05 | VLDCChGNVeFH | financial hub, enforcing |
| los_angeles | Los Angeles | US | 5 | 16 (L20) | 2 | 1.06 | 1.2 | VLDCChVeFH | financial hub, enforcing |
| vancouver | Vancouver | CA | 4 | 15.5 | 2 | 1.03 | 1.05 | VLDCChGVeFH | enforcing |
| ras_laffan | Ras Laffan | QA | 4 | 15.5 | 2 | 0.82 | 0.9 | LNG |  |
| tubarao | Tubarão | BR | 4 | 20 | 0 | 1.02 | 0.9 | VD |  |
| richards_bay | Richards Bay | ZA | 3 | 19 | 0 | 1 | 0.85 | VLD | family first |
| genes | Gênes | IT | 3 | 15 | 2 | 1.02 | 1.05 | VLDCChVeFH | enforcing |
| algesiras | Algésiras | ES | 4 | 18 | 1 | 0.88 | 0.95 | VLDCChF | enforcing |
| mersin | Mersin | TR | 3 | 14 | 1 | 0.98 | 0.85 | VLDCChVeF |  |
| gdansk | Gdańsk | PL | 3 | 15 | 2 | 0.98 | 0.9 | VLDCChNH | winter, enforcing |
| constanta | Constanța | RO | 4 | 19 | 2 | 0.97 | 0.85 | VLDCChGVeH | enforcing |
| bandar_abbas | Bandar Abbas | IR | 3 | 15 (L22) | 1 | 0.7 | 0.8 | VLDCChG | shadow home, embargoed, shady |
| djibouti | Djibouti | DJ | 2 | 15 | 0 | 1 | 0.9 | VLDCG | family first, shady |
| mombasa | Mombasa | KE | 2 | 13.5 | 1 | 1.05 | 0.95 | VLDCFVe | shady |
| luanda | Luanda | AO | 2 | 12.5 (L22) | 0 | 0.95 | 1.1 | VLDCN | family first, shady |
| tema | Tema | GH | 2 | 14 | 1 | 1.04 | 0.95 | VLDCF | shady |
| karachi | Karachi | PK | 3 | 13.5 | 1 | 0.95 | 0.85 | VLDCChN | shady |
| colombo | Colombo | LK | 3 | 18 | 2 | 0.9 | 0.9 | VLDCF |  |
| hong_kong | Hong Kong | HK | 5 | 17 | 3 | 0.92 | 1 | VLDCChVeFH | financial hub |
| port_klang | Port Klang | MY | 4 | 17 | 2 | 0.92 | 0.9 | VLDCChGF |  |
| jakarta | Jakarta | ID | 4 | 14 (V18) | 1 | 0.95 | 0.9 | VLDCChGN |  |
| manille | Manille | PH | 3 | 13 | 2 | 1 | 0.9 | VLDCF | shady |
| ho_chi_minh | Hô Chi Minh-Ville | VN | 4 | 15 | 2 | 0.96 | 0.85 | VLDCF |  |
| auckland | Auckland | NZ | 2 | 12.5 | 1 | 1.1 | 1.1 | VLDCFVe | enforcing |
| cartagena | Carthagène | CO | 3 | 14 (V19) | 2 | 0.97 | 0.95 | VLDCChF | family first, shady |
| veracruz | Veracruz | MX | 3 | 14 | 1 | 0.96 | 0.95 | VLDCChVeF | family first, shady |
| valparaiso | Valparaíso | CL | 3 | 14 | 1 | 1.05 | 1 | VLDCF |  |
| puerto_la_cruz | Puerto La Cruz | VE | 2 | 13 (L20) | 0 | 0.6 | 1 | VLDCCh | shadow home, embargoed, shady |
| novorossiysk | Novorossiïsk | RU | 4 | 15 (L17) | 1 | 0.75 | 0.9 | VLDCChG | shadow home, embargoed, shady |
| ust_luga | Oust-Louga | RU | 3 | 16 | 0 | 0.8 | 0.9 | VLDCChGN | winter, embargoed |
| vladivostok | Vladivostok | RU | 3 | 13 (L18) | 2 | 0.8 | 0.9 | VLDCFVe | embargoed |
| chittagong | Chittagong | BD | 3 | 9.5 (L12) | 1 | 1.05 | 1 | VLDCF | shady |
| arzew | Arzew | DZ | 3 | 14 (L18) | 0 | 0.8 | 0.9 | VLChGN | family first |
| jorf_lasfar | Jorf Lasfar | MA | 3 | 15 | 0 | 1 | 0.9 | VLChD |  |
| haifa | Haïfa | IL | 3 | 15.5 | 2 | 1.05 | 1.1 | VLDCChVeFH |  |
| es_sider | Es Sider | LY | 2 | 14 (L20) | 0 | 0.65 | 0.8 | L | shady |
| nampo | Nampo | KP | 1 | 10 | 0 | 1.2 | 0.7 | VLD | shadow home, embargoed, shady |
| valdez | Valdez | US | 2 | 20 | 0 | 1.15 | 1.1 | L | winter, enforcing |
| churchill | Churchill | CA | 2 | 12 | 0 | 1.3 | 1 | VDL | winter, enforcing, seasonal ice 196–309 |
| nome | Nome | US | 1 | 9 | 0 | 1.4 | 1 | DLC | winter, enforcing, seasonal ice 166–319 |
| murmansk | Mourmansk | RU | 3 | 15.5 | 2 | 0.85 | 0.9 | VLDCN | winter, embargoed |
| sabetta | Sabetta | RU | 2 | 13 | 0 | 1.1 | 1.1 | NLD | winter, embargoed, seasonal ice 182–320 |

## The flags (51, each with at least one port)


| Flag | Country | tax | crew | subsidy | rating | rate | ports |
|---|---|---|---|---|---|---|---|
| NL | Pays-Bas | 0.06 | 1.15 | 0 | 85 | 0.045 | rotterdam |
| DE | Allemagne | 0.078 | 1.2 | 0 | 85 | 0.045 | hambourg |
| FR | France | 0.09 | 1.225 | 0.04 | 82 | 0.05 | le_havre, marseille |
| GR | Grèce | 0.03 | 1.025 | 0 | 70 | 0.065 | piree |
| EG | Égypte | 0.132 | 0.85 | 0 | 45 | 0.12 | alexandrie |
| SA | Arabie saoudite | 0.03 | 0.975 | 0 | 55 | 0.06 | djeddah, ras_tanura |
| AE | Émirats arabes unis | 0 | 0.95 | 0 | 62 | 0.055 | dubai |
| IN | Inde | 0.15 | 0.825 | 0 | 55 | 0.09 | mumbai |
| SG | Singapour | 0 | 1.025 | 0 | 86 | 0.04 | singapour |
| CN | Chine | 0.12 | 0.875 | 0.12 | 60 | 0.05 | shanghai |
| KR | Corée du Sud | 0.108 | 0.975 | 0.1 | 75 | 0.05 | busan |
| JP | Japon | 0.15 | 1.15 | 0.08 | 86 | 0.02 | yokohama |
| AU | Australie | 0.18 | 1.325 | 0 | 85 | 0.055 | port_hedland, sydney |
| ZA | Afrique du Sud | 0.162 | 0.9 | 0 | 55 | 0.1 | durban, richards_bay |
| NG | Nigeria | 0.18 | 0.8 | 0 | 30 | 0.16 | lagos |
| CI | Côte d'Ivoire | 0.15 | 0.8 | 0 | 38 | 0.12 | abidjan |
| BR | Brésil | 0.204 | 0.95 | 0.05 | 50 | 0.12 | santos, tubarao |
| AR | Argentine | 0.21 | 0.925 | 0 | 35 | 0.25 | buenos_aires |
| US | États-Unis | 0.126 | 1.425 | 0 | 80 | 0.05 | new_york, houston, los_angeles, valdez, nome, prudhoe_bay |
| CA | Canada | 0.156 | 1.275 | 0 | 82 | 0.05 | vancouver, churchill |
| IT | Italie | 0.144 | 1.175 | 0.03 | 75 | 0.05 | genes |
| ES | Espagne | 0.15 | 1.125 | 0.02 | 75 | 0.05 | algesiras |
| TR | Turquie | 0.12 | 0.875 | 0.04 | 55 | 0.15 | mersin |
| PL | Pologne | 0.114 | 0.975 | 0.03 | 68 | 0.06 | gdansk |
| RO | Roumanie | 0.096 | 0.95 | 0 | 65 | 0.07 | constanta |
| IR | Iran | 0.15 | 0.8 | 0.06 | 20 | 0.22 | bandar_abbas |
| DJ | Djibouti | 0.15 | 0.85 | 0 | 35 | 0.12 | djibouti |
| KE | Kenya | 0.18 | 0.8 | 0 | 40 | 0.13 | mombasa |
| AO | Angola | 0.18 | 0.875 | 0 | 30 | 0.18 | luanda |
| GH | Ghana | 0.15 | 0.8 | 0 | 40 | 0.2 | tema |
| PK | Pakistan | 0.174 | 0.775 | 0 | 35 | 0.15 | karachi |
| LK | Sri Lanka | 0.144 | 0.8 | 0 | 45 | 0.12 | colombo |
| HK | Hong Kong | 0.048 | 1.05 | 0 | 85 | 0.045 | hong_kong |
| MY | Malaisie | 0.144 | 0.9 | 0.03 | 70 | 0.055 | port_klang |
| ID | Indonésie | 0.132 | 0.825 | 0.03 | 50 | 0.09 | jakarta |
| PH | Philippines | 0.15 | 0.775 | 0 | 45 | 0.08 | manille |
| VN | Viêt Nam | 0.12 | 0.8 | 0.06 | 55 | 0.07 | ho_chi_minh |
| NZ | Nouvelle-Zélande | 0.168 | 1.25 | 0 | 85 | 0.055 | auckland |
| CO | Colombie | 0.21 | 0.9 | 0 | 45 | 0.11 | cartagena |
| MX | Mexique | 0.18 | 0.925 | 0 | 55 | 0.1 | veracruz |
| CL | Chili | 0.162 | 0.975 | 0 | 70 | 0.07 | valparaiso |
| VE | Venezuela | 0.204 | 0.8 | 0 | 15 | 0.3 | puerto_la_cruz |
| QA | Qatar | 0.06 | 0.95 | 0 | 65 | 0.055 | ras_laffan |
| PA | Panama | 0 | 0.85 | 0 | 40 | 0.07 | colon |
| RU | Russie | 0.12 | 0.9 | 0.05 | 25 | 0.2 | novorossiysk, ust_luga, vladivostok, murmansk, sabetta |
| BD | Bangladesh | 0.165 | 0.75 | 0 | 35 | 0.12 | chittagong |
| DZ | Algérie | 0.156 | 0.875 | 0 | 40 | 0.1 | arzew |
| MA | Maroc | 0.15 | 0.875 | 0 | 55 | 0.07 | jorf_lasfar |
| IL | Israël | 0.138 | 1.15 | 0 | 75 | 0.055 | haifa |
| LY | Libye | 0.12 | 0.85 | 0 | 15 | 0.2 | es_sider |
| KP | Corée du Nord | 0.1 | 0.7 | 0 | 5 | 0.35 | nampo |
