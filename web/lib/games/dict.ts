// Lazily fetched word lists (public/games/*.json), cached for the life of the page.
//   common.json: everyday words, 4–9 letters (SCOWL size ≤ 35). Used for answers.
//   valid.json:  a broader list for checking guesses (3–9 letters, every 5-letter word).

let commonPromise: Promise<string[]> | null = null;
let validPromise: Promise<Set<string>> | null = null;

function fetchList(path: string): Promise<string[]> {
  return fetch(path).then((r) => {
    if (!r.ok) throw new Error(`Could not load ${path}`);
    return r.json() as Promise<string[]>;
  });
}

export function loadCommon(): Promise<string[]> {
  if (!commonPromise) {
    commonPromise = fetchList("/games/common.json").catch((e) => {
      commonPromise = null;
      throw e;
    });
  }
  return commonPromise;
}

export function loadValid(): Promise<Set<string>> {
  if (!validPromise) {
    validPromise = fetchList("/games/valid.json")
      .then((list) => new Set(list))
      .catch((e) => {
        validPromise = null;
        throw e;
      });
  }
  return validPromise;
}
