// Connections: hand-written puzzles of 16 words in four groups of four.
// Groups are listed easiest (yellow) to trickiest (purple). Red herrings are deliberate,
// but each puzzle has only one way to split all 16 words.
import { dayNumber, rngFrom, shuffle } from "./rng";

export type Level = 0 | 1 | 2 | 3;
export type Group = { title: string; words: [string, string, string, string] };
export type ConnectionsPuzzle = { id: string; groups: [Group, Group, Group, Group] };

export const LEVEL_COLORS = ["#f9df6d", "#a0c35a", "#b0c4ef", "#ba81c5"] as const;
export const LEVEL_NAMES = ["Yellow", "Green", "Blue", "Purple"] as const;

const g = (title: string, words: string): Group => {
  const w = words.split(",").map((s) => s.trim().toUpperCase());
  return { title, words: [w[0], w[1], w[2], w[3]] };
};

export const PUZZLES: ConnectionsPuzzle[] = [
  {
    id: "detectives",
    groups: [
      g("Shades of red", "crimson, scarlet, ruby, cherry"),
      g("___board", "key, surf, chess, skate"),
      g("Fictional detectives", "holmes, poirot, marple, columbo"),
      g("Hidden animals", "scatter, beard, antique, dogma"),
    ],
  },
  {
    id: "space-snacks",
    groups: [
      g("Pizza toppings", "pepperoni, mushroom, olive, onion"),
      g("Planets", "venus, saturn, mercury, jupiter"),
      g("Chocolate bars", "galaxy, bounty, snickers, twix"),
      g("___fish", "cat, sword, star, jelly"),
    ],
  },
  {
    id: "breakfast",
    groups: [
      g("Breakfast foods", "pancake, waffle, bacon, cereal"),
      g("Card games", "poker, bridge, snap, rummy"),
      g("Dog breeds", "boxer, poodle, beagle, pug"),
      g("Fire___", "fly, work, place, man"),
    ],
  },
  {
    id: "stage",
    groups: [
      g("Coffee drinks", "latte, mocha, espresso, macchiato"),
      g("Shakespeare plays", "hamlet, macbeth, othello, tempest"),
      g("Instruments", "tuba, harp, oboe, cello"),
      g("Board games", "risk, clue, sorry, monopoly"),
    ],
  },
  {
    id: "royalty",
    groups: [
      g("Weather", "rain, snow, hail, sleet"),
      g("Units of time", "second, minute, hour, decade"),
      g("In a deck of cards", "king, jack, ace, joker"),
      g("British bands", "queen, oasis, blur, genesis"),
    ],
  },
  {
    id: "kitchen-sea",
    groups: [
      g("Kitchen utensils", "whisk, ladle, spatula, tongs"),
      g("Sea creatures", "shark, whale, dolphin, octopus"),
      g("Racket sports", "tennis, squash, badminton, padel"),
      g("Hidden body parts", "chair, shipment, legend, search"),
    ],
  },
  {
    id: "rainbow",
    groups: [
      g("Rainbow colors", "red, orange, indigo, violet"),
      g("Citrus fruits", "lemon, lime, grapefruit, tangerine"),
      g("Flowers", "rose, tulip, daisy, lily"),
      g("One-name pop stars", "madonna, adele, shakira, rihanna"),
    ],
  },
  {
    id: "big",
    groups: [
      g("Up in the sky", "cloud, moon, rainbow, kite"),
      g("Computer gear", "mouse, keyboard, monitor, printer"),
      g("Chinese zodiac animals", "rat, ox, tiger, dragon"),
      g("Big ___", "ben, bang, foot, top"),
    ],
  },
  {
    id: "italy",
    groups: [
      g("Pasta shapes", "penne, fusilli, rigatoni, farfalle"),
      g("Italian cities", "rome, milan, venice, florence"),
      g("Car brands", "tesla, ford, volvo, ferrari"),
      g("Renaissance artists", "leonardo, raphael, botticelli, titian"),
    ],
  },
  {
    id: "wizards",
    groups: [
      g("Bodies of water", "lake, river, pond, ocean"),
      g("In your wallet", "cash, card, receipt, photo"),
      g("Hogwarts houses", "gryffindor, slytherin, hufflepuff, ravenclaw"),
      g("___fall", "water, night, down, land"),
    ],
  },
  {
    id: "dance",
    groups: [
      g("Cat breeds", "siamese, persian, bengal, sphynx"),
      g("Languages", "french, spanish, arabic, hindi"),
      g("Dances", "tango, salsa, waltz, foxtrot"),
      g("Dips and sauces", "ketchup, pesto, hummus, guacamole"),
    ],
  },
  {
    id: "trees",
    groups: [
      g("Footwear", "sneaker, boot, sandal, loafer"),
      g("Trees", "oak, maple, birch, willow"),
      g("Parts of a tree", "root, bark, branch, leaf"),
      g("___house", "tree, light, green, dog"),
    ],
  },
  {
    id: "heroes",
    groups: [
      g("Fast food", "burger, fries, nugget, milkshake"),
      g("Superheroes", "batman, hulk, flash, robin"),
      g("Camera parts", "lens, shutter, zoom, tripod"),
      g("Norse gods", "odin, loki, freya, thor"),
    ],
  },
  {
    id: "beach",
    groups: [
      g("At the beach", "sand, shell, towel, umbrella"),
      g("Ways to cook an egg", "scrambled, poached, fried, boiled"),
      g("Hairstyles", "bob, bun, braid, mohawk"),
      g("___cake", "pan, cup, cheese, short"),
    ],
  },
  {
    id: "calendar",
    groups: [
      g("Months", "june, august, april, july"),
      g("Ways to walk", "stroll, hike, march, wander"),
      g("Gemstones", "diamond, emerald, sapphire, opal"),
      g("___flower", "may, sun, wall, corn"),
    ],
  },
  {
    id: "rock",
    groups: [
      g("Music genres", "jazz, blues, rock, funk"),
      g("In the bathroom", "soap, towel, mirror, sink"),
      g("Types of rock", "granite, marble, slate, basalt"),
      g("___corn", "pop, candy, pepper, sweet"),
    ],
  },
  {
    id: "farmyard",
    groups: [
      g("Farm animals", "cow, goat, sheep, hen"),
      g("Chess pieces", "bishop, knight, rook, pawn"),
      g("Birds", "crow, eagle, robin, owl"),
      g("___tail", "pig, pony, dove, fish"),
    ],
  },
];

export function dailyPuzzle(day: string): ConnectionsPuzzle {
  const order = shuffle(PUZZLES, rngFrom("connections-order-v1"));
  const n = dayNumber(day);
  return order[((n % order.length) + order.length) % order.length];
}

/** The 16 words in a stable, date-seeded starting order. */
export function startingOrder(puzzle: ConnectionsPuzzle, day: string): string[] {
  return shuffle(
    puzzle.groups.flatMap((gr) => gr.words),
    rngFrom(`connections:${day}:${puzzle.id}`),
  );
}

export function groupOf(puzzle: ConnectionsPuzzle, word: string): number {
  return puzzle.groups.findIndex((gr) => gr.words.includes(word));
}
