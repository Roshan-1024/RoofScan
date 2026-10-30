import type { Locale } from "./config";

interface ErrorMessages {
  title: string;
  body: string;
  retry: string;
  startOver: string;
}

/** Kept apart from the dictionaries so the error boundary doesn't ship every page's text. */
export const errorMessages: Record<Locale, ErrorMessages> = {
  en: {
    title: "Something went wrong",
    body: "RoofScan ran into an unexpected problem. Try again, or start a new check if it keeps happening.",
    retry: "Try again",
    startOver: "Start a new check",
  },
  hi: {
    title: "कुछ गड़बड़ हो गई",
    body: "RoofScan में कोई अनचाही समस्या आ गई। फिर से कोशिश करें, और बार-बार ऐसा हो तो नई जाँच शुरू करें।",
    retry: "फिर से कोशिश करें",
    startOver: "नई जाँच शुरू करें",
  },
};
