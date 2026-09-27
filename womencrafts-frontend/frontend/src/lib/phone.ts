import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";
import isoCountries from "i18n-iso-countries";
import englishCountries from "i18n-iso-countries/langs/en.json";

isoCountries.registerLocale(englishCountries);
const SPECIAL_REGION_NAMES: Record<string, string> = {
  AC: "Ascension Island",
  TA: "Tristan da Cunha",
};

export const PHONE_COUNTRIES = getCountries()
  .map((code) => ({
    code,
    name: isoCountries.getName(code, "en") ?? SPECIAL_REGION_NAMES[code] ?? code,
    dial: `+${getCountryCallingCode(code)}`,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

export function normalizePhone(value: string, country: string): string | null {
  if (!country) return null;
  const parsed = parsePhoneNumberFromString(value, country as CountryCode);
  return parsed?.isValid() ? parsed.number : null;
}
