export const en = {
  meta: {
    title: "RoofScan: rooftop solar check for PM Surya Ghar",
    description:
      "Measure your roof from satellite imagery, read your electricity bill, and see the solar system you need, what it costs after the PM Surya Ghar subsidy, and how to apply.",
  },
  nav: {
    switchLanguage: "Switch language",
    home: "RoofScan home",
  },
  hero: {
    eyebrow: "For Indian households · PM Surya Ghar: Muft Bijli Yojana",
    title: "Find out what your roof can earn you.",
    body: "RoofScan measures your roof from satellite imagery and reads your electricity bill. In a few minutes you see the solar system that fits, what it costs after the government subsidy, what you will save, and exactly how to apply.",
    note: "Free and independent. Not a government service.",
  },
  how: {
    title: "How it works",
    steps: [
      {
        title: "Find your house",
        body: "Search your address or use your location, then tap your roof on the satellite map.",
      },
      {
        title: "We outline your roof",
        body: "Meta's SAM 3.1 traces your roof and marks water tanks, stair rooms and other obstacles. You can correct the outline.",
      },
      {
        title: "Add your electricity bill",
        body: "Take a photo of your bill. Muse Spark reads your units, sanctioned load and connection details, and you confirm them.",
      },
      {
        title: "Get your plan and apply",
        body: "See the system size, generation, savings, subsidy and payback. Download a report and follow a step-by-step application checklist.",
      },
    ],
  },
  benefits: {
    title: "What you get",
    items: [
      {
        title: "The right system size",
        body: "Based on your usable roof area, your actual electricity use and your sanctioned load.",
      },
      {
        title: "Monthly generation",
        body: "From long-term satellite sunlight data for your exact location (NASA POWER).",
      },
      {
        title: "Your subsidy",
        body: "Central financial assistance under PM Surya Ghar: ₹30,000 per kW for the first 2 kW and ₹18,000 for the third, up to ₹78,000.",
      },
      {
        title: "Savings and payback",
        body: "Calculated from the tariff on your own bill, not a national average.",
      },
      {
        title: "Rainwater from the same roof",
        body: "How many litres a year your roof could harvest, from long-term rainfall for your area.",
      },
      {
        title: "A report you can share",
        body: "A PDF with your roof, your numbers and the application checklist, with your consumer number masked.",
      },
    ],
  },
  privacy: {
    title: "Your data stays yours",
    items: [
      "Bill photos are read and discarded straight away. We never store them.",
      "Nothing is saved on our servers. Your report stays in your browser until you download it.",
      "No account and no analytics.",
    ],
  },
  disclaimer:
    "RoofScan gives estimates to help you decide. The final system design comes from a registered vendor's site survey and your electricity distribution company's (DISCOM) approval. RoofScan is an independent project and is not affiliated with the Government of India, MNRE or any DISCOM.",
  footer: {
    builtWith: "Built with Meta Muse Spark, SAM 3.1 and Muse Voice Transcribe.",
    data: "Data: NASA POWER, OpenStreetMap contributors, Esri World Imagery.",
    license: "Open source under the MIT License.",
  },
  notFound: {
    title: "Page not found",
    body: "This page does not exist.",
    back: "Go to the home page",
  },
};

/** Structural type every locale's dictionary must match. */
export type Dictionary = typeof en;
