// Warung Rush — recipes.js
// Pure data: every dish the warung serves and every ingredient on the counter.
// No functions with side effects, no game state. The game reads this file
// to build orders, match the player's pan, and price each plate.

export const INGREDIENTS = [
  { id: 'nasi',   name: 'Nasi',   key: '1', color: '#FFF6DC', dark: '#D9C48A', note: 'rice' },
  { id: 'mie',    name: 'Mie',    key: '2', color: '#F2C14E', dark: '#B98A1F', note: 'noodles' },
  { id: 'ayam',   name: 'Ayam',   key: '3', color: '#F2B8A0', dark: '#C97B57', note: 'chicken' },
  { id: 'telur',  name: 'Telur',  key: '4', color: '#FFFDF5', dark: '#E0B23C', note: 'egg' },
  { id: 'sate',   name: 'Sate',   key: '5', color: '#C97B3D', dark: '#7A3E14', note: 'skewers' },
  { id: 'kecap',  name: 'Kecap',  key: '6', color: '#5B2E1E', dark: '#2E1508', note: 'soy sauce' },
  { id: 'sambal', name: 'Sambal', key: '7', color: '#D32F2F', dark: '#7A1414', note: 'chili' },
  { id: 'bawang', name: 'Bawang', key: '8', color: '#E8C8E8', dark: '#8E5A8E', note: 'shallot' },
  { id: 'teh',    name: 'Teh',    key: '9', color: '#A8642A', dark: '#5E3410', note: 'tea' },
  { id: 'es',     name: 'Es',     key: '0', color: '#BFE8FF', dark: '#4A90B8', note: 'ice' },
];

export const INGREDIENT_BY_ID = Object.fromEntries(
  INGREDIENTS.map((ing) => [ing.id, ing]),
);

// Each dish: what goes in the pan, which station cooks it, how long it
// takes, what it pays, and how long a customer will wait for it.
// Ingredients overlap on purpose: kecap seasons both nasi goreng and sate,
// so a player who plans ahead serves two tickets from one idea.
export const DISHES = {
  nasgor: {
    id: 'nasgor',
    name: 'Nasi Goreng',
    short: 'NASGOR',
    price: 100,
    station: 'wok',
    cookTime: 3.0,
    patience: 45,
    color: '#E8A833',
    ingredients: ['nasi', 'telur', 'kecap'],
    blurb: 'Golden fried rice, egg on top',
  },
  mieayam: {
    id: 'mieayam',
    name: 'Mie Ayam',
    short: 'MIE AYAM',
    price: 110,
    station: 'wok',
    cookTime: 3.2,
    patience: 48,
    color: '#D97B29',
    ingredients: ['mie', 'ayam', 'bawang'],
    blurb: 'Noodles, chicken, shallot',
  },
  sate: {
    id: 'sate',
    name: 'Sate Ayam',
    short: 'SATE',
    price: 120,
    station: 'grill',
    cookTime: 3.5,
    patience: 50,
    color: '#C65D21',
    ingredients: ['sate', 'kecap', 'sambal'],
    blurb: 'Char-grilled skewers, peanut heat',
  },
  esteh: {
    id: 'esteh',
    name: 'Es Teh Manis',
    short: 'ES TEH',
    price: 60,
    station: 'drink',
    cookTime: 1.5,
    patience: 25,
    color: '#8B5A2B',
    ingredients: ['teh', 'es'],
    blurb: 'Sweet iced tea — the fast one',
  },
};

export const DISH_LIST = Object.values(DISHES);

export const STATIONS = {
  wok:   { id: 'wok',   name: 'WOK',   verb: 'MENGGORENG', color: '#E85D3D' },
  grill: { id: 'grill', name: 'GRILL', verb: 'MEMANGGANG', color: '#F08A1D' },
  drink: { id: 'drink', name: 'MINUMAN', verb: 'MENUANG',  color: '#4A90B8' },
};

// Find the dish whose ingredient set exactly matches the pan contents.
// Order does not matter; extra ingredients block every match.
export function matchRecipe(pan) {
  if (pan.length === 0) return null;
  const panSet = [...pan].sort().join(',');
  for (const dish of DISH_LIST) {
    if ([...dish.ingredients].sort().join(',') === panSet) return dish;
  }
  return null;
}

// Dishes the pan could still become: every ingredient in the pan is one
// the dish needs, and at least one is still missing. A partial pan is not
// a mistake — it is a dish mid-assembly — so the game names what is missing
// instead of crying "not a recipe".
export function partialRecipes(pan) {
  if (pan.length === 0) return [];
  return DISH_LIST.filter((dish) => {
    if (pan.length >= dish.ingredients.length) return false;
    return pan.every((ing) => dish.ingredients.includes(ing));
  });
}

export function missingIngredients(dish, pan) {
  return dish.ingredients.filter((ing) => !pan.includes(ing));
}

// Score for serving a dish: base price, a time bonus for fast service,
// a streak multiplier for consecutive serves, and 3x for VIP orders.
export function scoreFor(dish, patienceLeft, patienceMax, streak, isVip) {
  let points = dish.price;
  const frac = patienceMax > 0 ? patienceLeft / patienceMax : 0;
  if (frac > 0.5) points += 50;
  else if (frac > 0.25) points += 20;
  const streakMult = streak >= 10 ? 3 : streak >= 6 ? 2 : streak >= 3 ? 1.5 : 1;
  points = Math.round(points * streakMult);
  if (isVip) points *= 3;
  return points;
}

export function streakMultiplier(streak) {
  return streak >= 10 ? 3 : streak >= 6 ? 2 : streak >= 3 ? 1.5 : 1;
}
