import { describe, expect, it } from "vitest";
import { OpenMeteoError, parseRainfall } from "./open-meteo";

/** Synthetic daily series: `perDay` mm every day of each year, with optional gaps. */
function series(years: Record<number, { perDay: number; missingDays?: number }>) {
  const time: string[] = [];
  const precipitation_sum: Array<number | null> = [];
  for (const [yearText, { perDay, missingDays = 0 }] of Object.entries(years)) {
    const year = Number(yearText);
    const date = new Date(Date.UTC(year, 0, 1));
    let index = 0;
    while (date.getUTCFullYear() === year) {
      time.push(date.toISOString().slice(0, 10));
      precipitation_sum.push(index < missingDays ? null : perDay);
      date.setUTCDate(date.getUTCDate() + 1);
      index++;
    }
  }
  return { daily: { time, precipitation_sum } };
}

describe("parseRainfall", () => {
  it("averages the totals of complete years", () => {
    const rainfall = parseRainfall(
      series({ 2017: { perDay: 2 }, 2018: { perDay: 3 }, 2019: { perDay: 2 }, 2020: { perDay: 3 }, 2021: { perDay: 2 } }),
    );
    // 730 + 1095 + 730 + 1098 (leap year) + 730, over 5 years
    expect(rainfall.annualMm).toBeCloseTo((730 + 1095 + 730 + 1098 + 730) / 5);
    expect(rainfall).toMatchObject({ firstYear: 2017, lastYear: 2021, completeYears: 5 });
  });

  it("skips years with too many missing days", () => {
    const rainfall = parseRainfall(
      series({
        2017: { perDay: 2 },
        2018: { perDay: 2 },
        2019: { perDay: 2 },
        2020: { perDay: 2 },
        2021: { perDay: 2 },
        2022: { perDay: 50, missingDays: 30 },
      }),
    );
    expect(rainfall.completeYears).toBe(5);
    expect(rainfall.lastYear).toBe(2021);
  });

  it("needs at least five complete years", () => {
    expect(() => parseRainfall(series({ 2017: { perDay: 2 }, 2018: { perDay: 2 } }))).toThrow(OpenMeteoError);
  });

  it("rejects malformed responses", () => {
    expect(() => parseRainfall({ error: true, reason: "x" })).toThrow(OpenMeteoError);
    expect(() => parseRainfall({ daily: { time: ["2017-01-01"], precipitation_sum: [] } })).toThrow(OpenMeteoError);
  });
});
