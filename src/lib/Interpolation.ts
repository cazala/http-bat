const reInterpolation = /(\\{0,1})\{([^\}\{]+)\}/g;

import _ = require("lodash");

export function interpolateString(input: string, store: any): string {
  return input.replace(reInterpolation, (fulltext, startChar: string, match: string) => {
    if (startChar === "\\") return fulltext;

    let value = _.get(store, match);

    if (typeof value === "undefined") {
      return fulltext;
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    return value.toString();
  });
}

export function hasPendingInterpolations(input: string) {
  try {
    ensureAllInterpolations(input);
    return true;
  } catch (e) {
    return false;
  }
}

export function ensureAllInterpolations(input: string) {
  let list = [];
  input.replace(reInterpolation, (fulltext, scaped) => {
    if (scaped == "\\") return;
    list.push(fulltext);
    return fulltext;
  });

  if (list.length)
    throw new Error("Could not resolve text interpolations " + JSON.stringify(list) + " on " + JSON.stringify(input));
}