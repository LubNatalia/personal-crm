import { createCn } from "cn/config";

// Class merging that knows the custom scales from tokens.css. Without this,
// "text-16" is taken for a text color and dropped next to "text-ink",
// and "rounded-note" does not override "rounded-field"
export const cn = createCn({
  extend: {
    theme: {
      text: [
        "12",
        "13",
        "14",
        "15",
        "16",
        "17",
        "18",
        "20",
        "22",
        "24",
        "26",
        "h1",
        "h1-lg",
        "h2",
        "h2-lg",
        "h2-final",
        "h2-final-lg",
      ],
      radius: [
        "chip",
        "field",
        "field-lg",
        "note",
        "note-lg",
        "btn",
        "tile",
        "card",
        "card-lg",
        "section",
        "section-lg",
        "icon",
        "icon-lg",
      ],
      shadow: ["cta", "card", "card-lg", "step", "step-lg"],
    },
  },
});
