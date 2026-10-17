// Wordplay (a Wordle-style game): curated daily answers and guess scoring.
import { dayNumber, rngFrom, shuffle } from "./rng";

/** ~300 everyday five-letter answers. Guesses are checked against the larger valid.json list. */
export const ANSWERS: readonly string[] = `
about above actor acute admit adopt adult after again agent agree ahead alarm album alert
alike alive allow alone along alter amber among angel anger angle angry apple apply arena
argue arise armor aside asset audio award aware awful bacon badge baker basic beach beard
beast begin being below bench berry birth black blade blame blank blast blaze blend bless
blind block blood bloom board boast bonus boost booth brain brake brand brave bread break
brick bride brief bring broad brown brush build bunch burst cabin cable camel candy canoe
cargo carry catch cause chain chair chalk charm chart chase cheap check cheek cheer chess
chest chief child chill choir civic claim class clean clear clerk click cliff climb clock
close cloth cloud coach coast color couch count court cover craft crane crash cream crisp
crowd crown crust curve cycle daily dairy dance delay depth diary dizzy dough draft drain
drama dream dress drift drink drive eager eagle early earth eight elbow elder empty enjoy
enter equal error event exact extra fable faint faith false fancy feast fence ferry fever
field fifty final first flame flash fleet flock flood floor flour fluid focus force forge
forty frame fresh front frost fruit funny ghost giant given glass globe glove grace grade
grain grand grape grass great green greet grief grill group guard guess guest guide habit
happy harsh heart heavy hedge honey horse hotel house human humor ideal image index inner
input issue ivory jelly jewel joint judge juice knife knock label large laser later laugh
layer learn lemon level light limit linen lodge logic loyal lucky lunar lunch magic major
maker maple march match mayor medal metal minor model money month moral motor mount mouse
mouth movie music nerve never night noble noise north novel nurse ocean offer often olive
onion opera orbit order other otter owner paint panel paper party pasta patch peace peach
pearl pedal penny phone photo piano piece pilot pitch pizza place plain plane plant plate
plaza point polar porch pound power press price pride prime print prize proof proud pupil
puppy quick quiet quilt quote radar radio raise rally ranch range rapid raven reach ready
river roast robin robot rocky round route royal rural salad sauce scale scene scout shade
shape share shark sharp sheep shelf shell shine shirt shore short skill slice slope smart
smile smoke snack snake solar solid sound south space spare spark spice spoon sport squad
stage stair stamp stand start steam steel stone storm story stove sugar sunny sweet swing
table tasty teach thank theme thick thing think tiger toast today topic torch total tower
trace track trade trail train treat trend trial tribe trick truck trust truth tulip uncle
under unity upper urban usual valid value vapor video visit vital vivid vocal voice waste
watch water whale wheat wheel white whole woman world worry write young youth zebra
`
  .split(/\s+/)
  .filter(Boolean);

const ORDER = shuffle(ANSWERS, rngFrom("wordplay-order-v1"));

export function dailyAnswer(day: string): string {
  const n = dayNumber(day);
  return ORDER[((n % ORDER.length) + ORDER.length) % ORDER.length];
}

export type Mark = "correct" | "present" | "absent";

/** Scores a guess the standard way, so repeated letters are only marked as often as they occur. */
export function scoreGuess(guess: string, answer: string): Mark[] {
  const marks: Mark[] = Array(5).fill("absent");
  const left: Record<string, number> = {};
  for (let i = 0; i < 5; i++) {
    if (guess[i] === answer[i]) marks[i] = "correct";
    else left[answer[i]] = (left[answer[i]] ?? 0) + 1;
  }
  for (let i = 0; i < 5; i++) {
    if (marks[i] === "correct") continue;
    const c = guess[i];
    if (left[c]) {
      marks[i] = "present";
      left[c]--;
    }
  }
  return marks;
}

export const MARK_COLORS: Record<Mark, string> = {
  correct: "#6aaa64",
  present: "#c9b458",
  absent: "#787c7e",
};
