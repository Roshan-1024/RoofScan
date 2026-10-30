# Synthetic electricity bills

Test documents for `npm run eval:bills`, which reads each one with Muse Spark
and compares the result with `expected.json`.

**Every document here is synthetic.** The companies are fictional, every
value is invented, and each page carries a banner and watermark saying it is
not a real bill. No real bill, name, address or consumer number is
included.

The bills imitate the layouts and languages of bills in different states
(labels in Marathi, Kannada, Hindi, Tamil, Bengali and Gujarati next to
English), monthly, two-monthly and quarterly periods, arrears, interest and
early-payment rebates that must be left out of the current charges, and
several ways of writing the sanctioned load. They were written as HTML,
rendered in Chromium, and some were turned into phone-style photos
(perspective, rotation, uneven light, blur, JPEG compression) or a
low-resolution copy. Two are PDFs, as e-bills often are.

| File | Tests |
|---|---|
| `maharashtra-monthly-marathi` (PNG, PDF) | Marathi labels, reading dates instead of a period, arrears and interest excluded |
| `karnataka-monthly-kannada` (PNG, low-resolution JPEG) | Kannada labels, account number preferred over the RR number |
| `delhi-monthly-english` (PNG, photo) | Current demand versus total payable |
| `delhi-commercial-english` | Non-domestic tariff, so no subsidy |
| `uttar-pradesh-monthly-hindi` (PNG, photo) | Hindi labels, arrears and late payment surcharge excluded |
| `tamil-nadu-bimonthly-tamil` (PNG, PDF) | Tamil labels, two-month period |
| `west-bengal-quarterly-bengali` | Bengali labels, quarterly period, load in kVA, rebate ignored |
| `gujarat-bimonthly-gujarati` (PNG, photo) | Gujarati labels, "RGP" tariff meaning residential |
| `water-bill-not-electricity` | Must be refused: a water bill |
| `shop-receipt-not-a-bill` | Must be refused: a shop receipt |

`expected.json` lists, for each file, whether it is an electricity bill and
the values the form should receive: units, months, current charges, fixed
charges, sanctioned load in kW, residential or not, and consumer number.
