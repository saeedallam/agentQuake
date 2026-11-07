export interface Forecast {
  city: string;
  days: { day: number; tempC: number }[];
}

const BASE_TEMPERATURE: Record<string, number> = {
  Cairo: 31,
  Alexandria: 27,
  Aswan: 38,
};

export async function fetchForecast(
  city: string,
  days: number,
): Promise<Forecast> {
  const base = BASE_TEMPERATURE[city] ?? 25;
  return {
    city,
    days: Array.from({ length: days }, (_, index) => ({
      day: index + 1,
      tempC: base - index,
    })),
  };
}
