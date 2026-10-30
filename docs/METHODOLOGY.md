# Methodology

How RoofScan turns a roof and a bill into numbers. All constants live in
`src/lib/engine/assumptions.ts` and `src/lib/engine/subsidy.ts`.

## Solar resource

Long-term monthly average global horizontal irradiance (GHI) comes from the
NASA POWER climatology API (`ALLSKY_SFC_SW_DWN`, renewable-energy community),
in kWh/m²/day for each month. NASA POWER's grid is about half a degree, so
responses are cached per 0.05° of latitude and longitude.

## Generation

```
monthly generation (kWh) = capacity (kW) × GHI (kWh/m²/day) × days in month × 0.75
```

- **Performance ratio 0.75** covers inverter, wiring, soiling and
  high-temperature losses. Indian rooftop systems typically reach 0.75 to
  0.80, so this keeps estimates on the low side.
- Irradiance is horizontal. Tilting panels towards the south usually adds a
  few per cent, which RoofScan does not count.
- Check: for Pune this gives about 3.9 units per kW per day. Utility guidance
  is 3 to 4 units per kW per day (BSES), about 4 (TP Northern Odisha), and up
  to 5.5 on clear days.

## Panels and capacity

RoofScan models a typical 545 W module measuring 2.279 m × 1.134 m.
Capacity is the number of panels × 0.545 kW.

## Sizing

1. **Panels for consumption**: yearly consumption ÷ yearly units per kW ÷
   0.545, rounded to the nearest panel, minimum one.
2. **Panels on the roof**: the most that fit on the usable roof, from the
   layout step.
3. RoofScan recommends the smaller of the two. A household can choose a
   different count, still capped by the roof.

If the capacity is above the sanctioned load on the bill, RoofScan warns that
the DISCOM may ask for a load increase. It does not block the plan.

## Eligibility

From MNRE's operational guidelines for Central Financial Assistance (CFA) to
residential consumers:

- **Where**: every state and UT. An eligible consumer is anyone with a valid
  consumer account number at their distribution utility (a DISCOM, or the
  state's Power or Energy Department where there is no DISCOM). RoofScan
  confirms the pinned location is in India by reverse geocoding, because
  India's bounding box also covers parts of Pakistan, Nepal, Bhutan,
  Bangladesh, Sri Lanka and Myanmar. Points at sea count as outside India.
- **Who**: residential connections only; no CFA for government, commercial
  or industrial connections.
- **What**: grid-connected systems on a roof, terrace, balcony or elevated
  structure, with DCR modules (made in India from Indian-made cells),
  installed by a vendor registered on the national portal.
- **Once**: CFA is paid once per installation. A household that already
  received CFA for some capacity gets CFA only for the balance up to 3 kW
  in total (see below).
- **Until**: the scheme runs until 31 March 2027.

The guidelines set no income limit and do not exclude government
employees, despite claims on some websites.

## Subsidy

Central Financial Assistance (CFA) for individual households under
PM Surya Ghar, as amended by MNRE in July 2025:

| Category | First 2 kW | Third kW | Maximum |
|---|---|---|---|
| General | ₹30,000 per kW | ₹18,000 per kW | ₹78,000 |
| Special category | ₹33,000 per kW | ₹19,800 per kW | ₹85,800 |

- Special category: the eight North-Eastern states, Uttarakhand, Himachal
  Pradesh, Jammu and Kashmir, Ladakh, Andaman and Nicobar Islands and
  Lakshadweep.
- Capacity above 3 kW earns no further CFA. Fractional capacity is
  pro-rated at the same per-kW rates.
- The subsidy is never shown as larger than the system's cost.
- **Earlier subsidy**: if the household already received CFA for `p` kW,
  the new system of `n` kW earns CFA(min(p + n, 3)) − CFA(min(p, 3)). The
  guidelines' own example: 1 kW subsidised before, total raised to 4 kW,
  CFA of ₹48,000 for the extra 2 kW. This is a unit test.
- State top-up subsidies are not included.

## Cost

The default installed cost is ₹55,000 per kW before subsidy. Market prices
for 1 to 3 kW systems run roughly ₹45,000 to ₹65,000 per kW, and MSEDCL's
benchmark is ₹45,450 per kW. Households can enter their vendor's quote.

## From the bill

- **Yearly consumption** = units on the bill ÷ months in the billing period
  × 12. Consumption is treated as even through the year.
- **Price per unit** = (bill amount − fixed charges) ÷ units. Fixed or demand
  charges stay the same after solar, so they are left out of savings.
  RoofScan warns when this is below ₹1.50 or above ₹20, which usually means
  a typing mistake.
- **Connection type**: PM Surya Ghar only covers residential connections, so
  other connections get no subsidy.
- **Sanctioned load**: compared against the system size for a warning only.

## Savings and payback

- **Tariff**: the average price per unit on the household's own bill.
- **Net metering** is settled yearly. Units up to the year's consumption are
  worth the tariff. Units beyond it are worth the state's export rate, which
  is ₹0 unless the household enters one.
- Slab tariffs charge more for the last units used, which solar removes
  first, so using the average tariff understates savings.
- **Payback** = net cost ÷ first-year savings.
- **Lifetime savings** are summed over 25 years with 0.5% yearly module
  degradation and no tariff increases. Maintenance and the inverter
  replacement most systems need once in 25 years are not subtracted.

## Roof measurement

- **Imagery**: Esri World Imagery. RoofScan asks the service's tile map for
  the highest zoom with real imagery at the tapped point (19 in most cities,
  18 in many rural areas) and stitches a 400 × 400 pixel square centred on
  it. Zoom 17 and below are rejected as too coarse.
- **Scale**: metres per pixel = 40,075,016.686 × cos(latitude) ÷ (256 × 2^zoom).
  At zoom 19 in Pune that is 0.283 m, so the snapshot covers about 113 m.
- **Area**: the outline's area in pixels (shoelace formula) × (metres per
  pixel)². A one-pixel error along each edge of a 10 m × 10 m roof changes
  the area by about 6%.
- **Your own photo**: where Esri imagery is too coarse, households can use
  a photo taken from straight above (a drone photo or a map screenshot). It
  is fitted into an 800 × 800 pixel square, and the scale comes from a line
  they mark on something of known length: metres per pixel = real length ÷
  line length in pixels. Lines under 20 pixels and lengths outside 1 to
  200 metres are rejected. A photo taken at an angle stretches distances,
  so only straight-down photos give accurate areas.

## Panel layout

- **Usable area**: the roof outline shrunk by a 0.6 m walkway along every
  edge, minus each obstacle grown by 0.5 m of clearance.
- **Mounting**: 545 W modules at a 15° tilt, in rows along one roof axis,
  tilted towards the other. Rows follow the roof's walls rather than true
  east-west, which costs at most a few per cent of output for roofs turned
  less than 45°.
- **Row spacing**: rows must not shade each other between 9:00 and 15:00
  solar time on 21 December, the usual design rule for Indian rooftop
  systems. The shadow cast towards the next row is

  ```
  height × cos(sun azimuth from south) ÷ tan(sun elevation)
  ```

  with the sun's position at 9:00 on the winter solstice. In Pune that adds
  0.70 m behind each portrait row, giving rows 2.91 m apart.
- **Packing**: the usable area is rasterised on a 5 cm grid. Portrait and
  landscape mounting are both tried, each with row offsets in 20 cm steps;
  panels are placed left to right in each row, and the arrangement with the
  most panels wins.
- **Compared with utility guidance**: utilities quote about 10 m² of roof per
  kW, which allows for generous walkways and steeper tilts. RoofScan's layout
  typically needs 6 to 7 m² per kW. Because RoofScan sizes the system to the
  household's consumption, most homes are not limited by roof space; where
  they are, a vendor's layout may hold fewer panels.

## Rainwater

```
litres per year = roof area (m²) × annual rainfall (mm) × 0.8
```

- **Rainfall** is the average of complete years from 2017 to 2024 at the
  roof's location, from the ECMWF IFS model (about 9 km grid) via the
  Open-Meteo historical weather API. A year counts if at least 360 days have
  data, and at least five complete years are needed. Households can replace
  the figure with their own.
- No free source is accurate everywhere. Compared with the India
  Meteorological Department's long-term averages:

  | City | IMD average | ECMWF IFS 2017–2024 | ERA5 (~25 km) | NASA POWER (~55 km) |
  |---|---|---|---|---|
  | Pune | ~722 mm | ~1,100 mm | 1,286 mm | 1,730 mm |
  | Delhi | ~774 mm | 701 mm | 717 mm | |
  | Chennai | ~1,400 mm | 1,321 mm | 1,128 mm | |

  Near the Western Ghats every model reads high, partly because recent
  years there have been wetter than the long-term average. RoofScan uses
  the finest-grained source and shows where the figure comes from.

- 1 mm of rain on 1 m² is 1 litre. The runoff coefficient of 0.8 is in the
  middle of the 0.7 to 0.9 range usually used for hard roofs.
- Household days = litres ÷ (people × 135 litres per person per day, the
  CPHEEO urban norm). The default household is four people.

## Known limitations

- Shading from trees and neighbouring buildings is not modelled.
- Sloped roofs are measured as their flat plan area. Indian residential
  roofs are mostly flat.
- These are estimates. The final design comes from a registered vendor's site
  survey and the DISCOM's approval.

## Sources

- NASA POWER API: https://power.larc.nasa.gov/docs/services/api/
- BSES Delhi rooftop solar FAQ (Sep 2025): https://www.bsesdelhi.com/documents/55701/1611949183/RTS_FAQ_Sep25.pdf
- TP Northern Odisha PM Surya Ghar FAQ: https://odia.tpnodl.com/Editor_UploadedDocuments/Content/FAQ_PM_Suryaghar_Muft_Bijli_Yojana__English.pdf
- MSEDCL rooftop solar FAQ (10 m² per kW): https://www.mahadiscom.in/ismart/media/faq.pdf
- MNRE operational guidelines, CFA to residential consumers (copy published by the Government of Delhi): https://solar.delhi.gov.in/public/assets/solar/PMSG_Guidelines_for_Residential_CFA_Capex_Mode.pdf
- MNRE amended CFA guidelines, July 2025: https://www.mercomindia.com/mnre-revises-central-financial-assistance-norms-under-pm-surya-ghar-program
- Rajya Sabha question 267, March 2025 (CFA table): https://rsdebate.nic.in/bitstream/123456789/759049/1/PQ_267_11032025_U1419_p455_p456.pdf
- MSEDCL benchmark cost: https://powerpeakdigest.com/msedcl-sets-rs-45450-per-kw-benchmark-for-rooftop-solar/
