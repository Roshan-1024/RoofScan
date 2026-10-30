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
- State top-up subsidies are not included.

## Cost

The default installed cost is ₹55,000 per kW before subsidy. Market prices
for 1 to 3 kW systems run roughly ₹45,000 to ₹65,000 per kW, and MSEDCL's
benchmark is ₹45,450 per kW. Households can enter their vendor's quote.

## Savings and payback

- **Tariff**: the average price per unit on the household's own bill.
- **Net metering** is settled yearly. Units up to the year's consumption are
  worth the tariff. Units beyond it are worth the state's export rate, which
  is ₹0 unless the household enters one.
- Slab tariffs charge more for the last units used, which solar removes
  first, so using the average tariff understates savings.
- **Payback** = net cost ÷ first-year savings.
- **Lifetime savings** are summed over 25 years with 0.5% yearly module
  degradation and no tariff increases.

## Rainwater

```
litres per year = roof area (m²) × annual rainfall (mm) × 0.8
```

- 1 mm of rain on 1 m² is 1 litre. The runoff coefficient of 0.8 is in the
  middle of the 0.7 to 0.9 range usually used for hard roofs.
- Household days = litres ÷ (people × 135 litres per person per day, the
  CPHEEO urban norm). The default household is four people.

## Known limitations

- Shading from trees and neighbouring buildings is not modelled.
- Roof tilt and orientation are not modelled. Indian residential roofs are
  mostly flat.
- These are estimates. The final design comes from a registered vendor's site
  survey and the DISCOM's approval.

## Sources

- NASA POWER API: https://power.larc.nasa.gov/docs/services/api/
- BSES Delhi rooftop solar FAQ (Sep 2025): https://www.bsesdelhi.com/documents/55701/1611949183/RTS_FAQ_Sep25.pdf
- TP Northern Odisha PM Surya Ghar FAQ: https://odia.tpnodl.com/Editor_UploadedDocuments/Content/FAQ_PM_Suryaghar_Muft_Bijli_Yojana__English.pdf
- MSEDCL rooftop solar FAQ (10 m² per kW): https://www.mahadiscom.in/ismart/media/faq.pdf
- MNRE amended CFA guidelines, July 2025: https://www.mercomindia.com/mnre-revises-central-financial-assistance-norms-under-pm-surya-ghar-program
- Rajya Sabha question 267, March 2025 (CFA table): https://rsdebate.nic.in/bitstream/123456789/759049/1/PQ_267_11032025_U1419_p455_p456.pdf
- MSEDCL benchmark cost: https://powerpeakdigest.com/msedcl-sets-rs-45450-per-kw-benchmark-for-rooftop-solar/
