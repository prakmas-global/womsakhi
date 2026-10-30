import type { HealthSettings, MealType } from "@/lib/health-api";

/**
 * Nutrition content — the approved Health & Wellness design's recipes, and the
 * everyday foods a woman can tap instead of typing.
 *
 * kcal and protein are per-serving ESTIMATES (the screens say so). Nothing
 * here is a diet plan for a condition; that is a nutritionist's job, and the
 * screens link to one.
 */

export const MEAL_TYPES: MealType[] = ["Breakfast", "Lunch", "Evening snack", "Dinner"];

export const DIETS: HealthSettings["diet"][] = ["Vegetarian", "Eggetarian", "Non-vegetarian", "Vegan"];
const ALL = DIETS;
/** Dishes with dairy or paneer: every diet but vegan. */
const NOT_VEGAN: HealthSettings["diet"][] = ["Vegetarian", "Eggetarian", "Non-vegetarian"];
const EGG: HealthSettings["diet"][] = ["Eggetarian", "Non-vegetarian"];
const MEAT: HealthSettings["diet"][] = ["Non-vegetarian"];

export const MEAL_ICON: Record<MealType, string> = {
  Breakfast: "Sun", Lunch: "Utensils", "Evening snack": "Coffee", Dinner: "Moon",
};

/** The meal she is most likely logging now. */
export function mealByTime(d = new Date()): MealType {
  const h = d.getHours();
  return h < 11 ? "Breakfast" : h < 16 ? "Lunch" : h < 19 ? "Evening snack" : "Dinner";
}

export interface Recipe {
  id: string; name: string; meal: MealType; mins: number; kcal: number; protein: number;
  suits: HealthSettings["diet"][]; tags: string[]; ing: string[]; steps: string[];
}

export const RECIPES: Recipe[] = [
  { id: "chilla", name: "Moong dal chilla", meal: "Breakfast", mins: 25, kcal: 260, protein: 14, suits: ALL, tags: ["High protein"],
    ing: ["1 cup yellow moong dal, soaked 3 hours", "Ginger and green chilli", "Coriander leaves", "Salt and a pinch of turmeric", "1 tsp oil"],
    steps: ["Grind the dal with ginger, chilli and a little water into a smooth batter.", "Mix in salt, turmeric and chopped coriander.", "Spread a ladle of batter thin on a hot pan with a few drops of oil.", "Cook both sides until golden. Serve with mint chutney."] },
  { id: "poha", name: "Vegetable poha", meal: "Breakfast", mins: 20, kcal: 280, protein: 6, suits: ["Vegetarian", "Eggetarian", "Non-vegetarian", "Vegan"], tags: ["Light"],
    ing: ["1½ cups thick poha", "1 onion, chopped", "½ cup peas and carrots", "Peanuts, curry leaves, mustard seeds", "Lemon, salt, turmeric"],
    steps: ["Rinse the poha and let it soften for 5 minutes.", "Fry mustard seeds, curry leaves and peanuts in a little oil.", "Add onion and vegetables and cook until soft.", "Stir in poha, salt and turmeric. Finish with lemon."] },
  { id: "ragi", name: "Ragi porridge", meal: "Breakfast", mins: 15, kcal: 220, protein: 7, suits: NOT_VEGAN, tags: ["Calcium", "Iron"],
    ing: ["3 tbsp ragi flour", "1 cup milk", "1 cup water", "Jaggery to taste", "A pinch of cardamom"],
    steps: ["Mix the ragi flour into the water with no lumps.", "Cook on low heat, stirring, for 5 minutes.", "Add milk and cook 3 more minutes.", "Sweeten with jaggery and cardamom."] },
  { id: "palak", name: "Palak dal with rice", meal: "Lunch", mins: 35, kcal: 420, protein: 16, suits: ["Vegetarian", "Eggetarian", "Non-vegetarian", "Vegan"], tags: ["Iron", "High protein"],
    ing: ["½ cup toor dal", "2 cups chopped spinach", "Garlic, tomato, cumin", "Cooked rice"],
    steps: ["Pressure-cook the dal until soft.", "Fry cumin and garlic, then add tomato and spinach.", "Mix in the dal and simmer for 5 minutes.", "Serve hot with rice."] },
  { id: "rajma", name: "Rajma bowl", meal: "Lunch", mins: 40, kcal: 450, protein: 17, suits: ["Vegetarian", "Eggetarian", "Non-vegetarian", "Vegan"], tags: ["Fibre", "High protein"],
    ing: ["1 cup soaked rajma", "Onion, tomato, ginger-garlic", "Rajma masala", "Rice or roti"],
    steps: ["Pressure-cook the rajma until soft.", "Cook onion, ginger-garlic and tomato into a thick masala.", "Add the rajma and simmer for 10 minutes.", "Serve with rice or roti and a salad."] },
  { id: "curdrice", name: "Curd rice with pomegranate", meal: "Lunch", mins: 15, kcal: 330, protein: 9, suits: NOT_VEGAN, tags: ["Cooling"],
    ing: ["1 cup cooked rice", "1 cup curd", "Pomegranate seeds", "Mustard seeds, curry leaves", "Salt"],
    steps: ["Mash the rice lightly and mix with curd and salt.", "Temper mustard seeds and curry leaves in a little oil.", "Pour over the rice and top with pomegranate."] },
  { id: "chana", name: "Roasted chana chaat", meal: "Evening snack", mins: 10, kcal: 180, protein: 9, suits: ALL, tags: ["Quick", "High protein"],
    ing: ["½ cup roasted chana", "Cucumber and tomato, chopped", "Lemon juice", "Chaat masala", "Coriander leaves"],
    steps: ["Mix everything in a bowl.", "Taste and adjust lemon and chaat masala."] },
  { id: "khichdi", name: "Vegetable khichdi", meal: "Dinner", mins: 30, kcal: 380, protein: 13, suits: ALL, tags: ["Easy to digest"],
    ing: ["½ cup rice", "¼ cup moong dal", "Bottle gourd, beans and peas", "Cumin, turmeric, ghee"],
    steps: ["Rinse rice and dal together.", "Fry cumin in ghee, add vegetables, rice, dal and turmeric.", "Add 3 cups of water and pressure-cook for 3 whistles."] },
  { id: "paneer", name: "Paneer bhurji with roti", meal: "Dinner", mins: 25, kcal: 430, protein: 22, suits: ["Vegetarian", "Eggetarian", "Non-vegetarian"], tags: ["High protein"],
    ing: ["150 g paneer, crumbled", "Onion, tomato, capsicum", "Turmeric, chilli, garam masala", "2 rotis"],
    steps: ["Cook onion, capsicum and tomato until soft.", "Add spices and the paneer and cook for 3 minutes.", "Serve with roti."] },
  { id: "egg", name: "Egg curry with roti", meal: "Dinner", mins: 30, kcal: 450, protein: 20, suits: ["Eggetarian", "Non-vegetarian"], tags: ["High protein"],
    ing: ["2 boiled eggs", "Onion-tomato masala", "Curry leaves, spices", "2 rotis"],
    steps: ["Make an onion-tomato masala with spices.", "Add water and simmer to a curry.", "Add halved boiled eggs and cook for 5 minutes."] },
  { id: "fish", name: "Grilled fish with salad", meal: "Dinner", mins: 25, kcal: 380, protein: 30, suits: ["Non-vegetarian"], tags: ["High protein"],
    ing: ["1 fish fillet", "Lemon, turmeric, chilli, salt", "Cucumber, tomato and greens"],
    steps: ["Rub the fish with lemon and spices. Rest 10 minutes.", "Grill or pan-cook 3–4 minutes each side.", "Serve with a fresh salad."] },
  /* ── more vegetarian ── */
  { id: "besan", name: "Besan chilla with curd", meal: "Breakfast", mins: 20, kcal: 290, protein: 13, suits: NOT_VEGAN, tags: ["High protein", "Quick"],
    ing: ["1 cup besan", "Onion, tomato, green chilli, coriander", "Ajwain, turmeric, salt", "1 bowl curd"],
    steps: ["Whisk besan with water into a pouring batter.", "Stir in the chopped vegetables and spices.", "Cook thin chillas on a lightly oiled pan, both sides.", "Serve with curd."] },
  { id: "upma", name: "Vegetable rava upma", meal: "Breakfast", mins: 20, kcal: 270, protein: 7, suits: ALL, tags: ["Light"],
    ing: ["1 cup rava", "Onion, carrot, beans, peas", "Mustard seeds, curry leaves, urad dal", "Ginger, green chilli"],
    steps: ["Dry roast the rava until it smells nutty.", "Temper mustard, urad dal and curry leaves; add the vegetables.", "Pour in 2½ cups hot water with salt.", "Stir in the rava slowly and cook covered for 3 minutes."] },
  { id: "chole", name: "Chana masala with rice", meal: "Lunch", mins: 40, kcal: 470, protein: 18, suits: ALL, tags: ["Iron", "Fibre"],
    ing: ["1 cup soaked kabuli chana", "Onion, tomato, ginger-garlic", "Chole masala", "Rice or roti"],
    steps: ["Pressure-cook the chana until soft.", "Cook onion, ginger-garlic and tomato with chole masala.", "Add the chana and simmer 10 minutes.", "Serve with rice and onion salad."] },
  { id: "sprouts", name: "Sprouts chaat", meal: "Evening snack", mins: 10, kcal: 160, protein: 10, suits: ALL, tags: ["High protein", "Quick"],
    ing: ["1 cup moong sprouts, lightly steamed", "Onion, tomato, cucumber", "Lemon, chaat masala", "Coriander"],
    steps: ["Steam the sprouts for 3 minutes.", "Mix with chopped vegetables.", "Season with lemon and chaat masala."] },
  { id: "makhana", name: "Roasted makhana", meal: "Evening snack", mins: 10, kcal: 140, protein: 4, suits: ALL, tags: ["Light", "Calcium"],
    ing: ["2 cups makhana", "1 tsp ghee or oil", "Salt, pepper, chaat masala"],
    steps: ["Roast the makhana in ghee on low heat until crisp.", "Toss with salt and spices. Cool and store."] },
  { id: "tikka", name: "Paneer tikka with salad", meal: "Dinner", mins: 30, kcal: 400, protein: 24, suits: NOT_VEGAN, tags: ["High protein"],
    ing: ["200 g paneer cubes", "Hung curd, ginger-garlic, tikka masala", "Capsicum and onion", "Cucumber salad"],
    steps: ["Marinate paneer and vegetables in spiced curd for 20 minutes.", "Grill or pan-roast until charred at the edges.", "Serve with salad and mint chutney."] },
  /* ── with eggs ── */
  { id: "omelette", name: "Masala omelette with toast", meal: "Breakfast", mins: 10, kcal: 310, protein: 16, suits: EGG, tags: ["High protein", "Quick"],
    ing: ["2 eggs", "Onion, tomato, green chilli, coriander", "Salt, pepper, turmeric", "2 slices whole wheat bread"],
    steps: ["Beat the eggs with the chopped vegetables and spices.", "Pour onto a hot oiled pan and cook on medium heat.", "Fold and serve with toast."] },
  { id: "bhurji", name: "Egg bhurji with roti", meal: "Breakfast", mins: 15, kcal: 330, protein: 17, suits: EGG, tags: ["High protein"],
    ing: ["3 eggs", "Onion, tomato, capsicum", "Turmeric, chilli, garam masala", "2 rotis"],
    steps: ["Cook onion, capsicum and tomato until soft.", "Add the spices, then the beaten eggs.", "Stir until just set. Serve with roti."] },
  { id: "eggrice", name: "Egg fried rice", meal: "Lunch", mins: 20, kcal: 450, protein: 17, suits: EGG, tags: ["Quick"],
    ing: ["1½ cups cooked rice", "2 eggs", "Beans, carrot, cabbage, spring onion", "Soy sauce, pepper"],
    steps: ["Scramble the eggs in a hot pan and keep aside.", "Stir-fry the vegetables on high heat.", "Add rice, soy sauce and pepper; toss.", "Fold the eggs back in."] },
  { id: "eggchaat", name: "Boiled egg chaat", meal: "Evening snack", mins: 15, kcal: 190, protein: 13, suits: EGG, tags: ["High protein"],
    ing: ["2 boiled eggs", "Onion, tomato, coriander", "Lemon, chaat masala"],
    steps: ["Chop the boiled eggs.", "Mix with onion, tomato and coriander.", "Season with lemon and chaat masala."] },
  { id: "eggdosa", name: "Egg dosa with chutney", meal: "Dinner", mins: 15, kcal: 360, protein: 15, suits: EGG, tags: ["High protein"],
    ing: ["Dosa batter", "2 eggs", "Onion, green chilli, pepper", "Coconut chutney"],
    steps: ["Spread a dosa on a hot tawa.", "Pour a beaten egg with onion and chilli over it and spread.", "Cook until the egg sets; fold and serve with chutney."] },
  /* ── with chicken, fish or mutton ── */
  { id: "chickencurry", name: "Home-style chicken curry with rice", meal: "Lunch", mins: 45, kcal: 560, protein: 32, suits: MEAT, tags: ["High protein"],
    ing: ["250 g chicken, curry cut", "Onion, tomato, ginger-garlic", "Curd, chilli, coriander and garam masala", "Rice"],
    steps: ["Marinate chicken in curd and spices for 20 minutes.", "Cook onion, ginger-garlic and tomato into a masala.", "Add the chicken and cook covered until done.", "Serve with rice."] },
  { id: "fishcurry", name: "Fish curry with rice", meal: "Lunch", mins: 35, kcal: 500, protein: 30, suits: MEAT, tags: ["High protein", "Omega-3"],
    ing: ["300 g fish (rohu, pomfret or surmai)", "Tamarind, tomato, onion", "Turmeric, chilli, coriander powder", "Curry leaves, rice"],
    steps: ["Rub the fish with turmeric and salt.", "Make a masala with onion, tomato and spices; add tamarind water.", "Slide in the fish and simmer 8–10 minutes.", "Serve with rice."] },
  { id: "chickensoup", name: "Chicken and vegetable soup", meal: "Evening snack", mins: 30, kcal: 210, protein: 20, suits: MEAT, tags: ["Light", "High protein"],
    ing: ["150 g boneless chicken", "Carrot, beans, cabbage", "Garlic, pepper, salt"],
    steps: ["Boil chicken with garlic until cooked; shred it.", "Add chopped vegetables to the stock and simmer.", "Return the chicken; season with pepper."] },
  { id: "chickentikka", name: "Chicken tikka with salad", meal: "Dinner", mins: 35, kcal: 420, protein: 35, suits: MEAT, tags: ["High protein"],
    ing: ["250 g boneless chicken", "Hung curd, ginger-garlic, tikka masala", "Lemon", "Onion and cucumber salad"],
    steps: ["Marinate the chicken for at least 30 minutes.", "Grill, air-fry or pan-roast until cooked through.", "Serve with salad and lemon."] },
  { id: "keema", name: "Mutton keema with roti", meal: "Dinner", mins: 40, kcal: 520, protein: 30, suits: MEAT, tags: ["Iron", "High protein"],
    ing: ["250 g mutton mince", "Onion, tomato, peas", "Ginger-garlic, garam masala", "2 rotis"],
    steps: ["Brown the onion with ginger-garlic.", "Add the mince and cook until it changes colour.", "Add tomato, peas and spices; cook covered until done.", "Serve with roti."] },
];

/** Everyday foods to tap — rough per-serving estimates. */
export const FOODS: { food: string; kcal: number; protein: number; meal: MealType[]; suits?: HealthSettings["diet"][] }[] = [
  { food: "2 idli with sambar", kcal: 250, protein: 8, meal: ["Breakfast"] },
  { food: "Upma", kcal: 250, protein: 6, meal: ["Breakfast"] },
  { food: "2 parathas with curd", kcal: 450, protein: 12, meal: ["Breakfast", "Dinner"] },
  { food: "Tea with milk", kcal: 80, protein: 3, meal: ["Breakfast", "Evening snack"] },
  { food: "Dosa with chutney", kcal: 300, protein: 7, meal: ["Breakfast", "Dinner"] },
  { food: "Dal, rice and sabzi", kcal: 500, protein: 16, meal: ["Lunch", "Dinner"] },
  { food: "2 roti with sabzi", kcal: 350, protein: 10, meal: ["Lunch", "Dinner"] },
  { food: "Curd (1 bowl)", kcal: 100, protein: 6, meal: ["Lunch", "Dinner", "Evening snack"] },
  { food: "Fruit", kcal: 80, protein: 1, meal: ["Breakfast", "Evening snack"] },
  { food: "Sprouts salad", kcal: 150, protein: 9, meal: ["Evening snack", "Lunch"] },
  { food: "Handful of nuts", kcal: 170, protein: 5, meal: ["Evening snack"] },
  { food: "Boiled eggs (2)", kcal: 155, protein: 13, meal: ["Breakfast", "Evening snack"], suits: ["Eggetarian", "Non-vegetarian"] },
  { food: "Chicken curry with rice", kcal: 600, protein: 30, meal: ["Lunch", "Dinner"], suits: ["Non-vegetarian"] },
  { food: "Biscuits (4)", kcal: 180, protein: 3, meal: ["Evening snack"] },
  { food: "Paneer paratha with curd", kcal: 420, protein: 16, meal: ["Breakfast", "Dinner"], suits: NOT_VEGAN },
  { food: "Chana dal with roti", kcal: 400, protein: 15, meal: ["Lunch", "Dinner"] },
  { food: "Masala omelette (2 eggs)", kcal: 200, protein: 13, meal: ["Breakfast", "Evening snack"], suits: EGG },
  { food: "Egg bhurji with roti", kcal: 330, protein: 17, meal: ["Breakfast", "Dinner"], suits: EGG },
  { food: "Egg curry with rice", kcal: 480, protein: 18, meal: ["Lunch", "Dinner"], suits: EGG },
  { food: "Fish curry with rice", kcal: 500, protein: 30, meal: ["Lunch", "Dinner"], suits: MEAT },
  { food: "Chicken tikka (6 pieces)", kcal: 300, protein: 32, meal: ["Dinner", "Evening snack"], suits: MEAT },
  { food: "Mutton curry with roti", kcal: 580, protein: 30, meal: ["Lunch", "Dinner"], suits: MEAT },
  { food: "Chicken sandwich", kcal: 320, protein: 22, meal: ["Evening snack", "Breakfast"], suits: MEAT },
];

/**
 * What each diet means for her plate: where protein and iron come from, what
 * to watch, and an easy day of meals. General guidance only — the screens say so.
 */
export const DIET_GUIDE: Record<HealthSettings["diet"], { line: string; protein: string[]; iron: string[]; watch: string; day: Record<MealType, string> }> = {
  Vegetarian: {
    line: "Dal, dairy and grains together give you complete protein.",
    protein: ["Dal and rajma", "Paneer and curd", "Chana and sprouts", "Milk", "Soya chunks"],
    iron: ["Spinach and methi", "Ragi and bajra", "Jaggery", "Dates and raisins", "Chana"],
    watch: "Have vitamin C (lemon, amla, guava) with iron-rich food, and tea an hour away from meals.",
    day: { Breakfast: "Besan chilla with curd", Lunch: "Palak dal with rice", "Evening snack": "Sprouts chaat", Dinner: "Paneer tikka with salad" },
  },
  Eggetarian: {
    line: "Eggs add easy, complete protein to a vegetarian plate.",
    protein: ["Eggs", "Dal and rajma", "Paneer and curd", "Chana and sprouts", "Milk"],
    iron: ["Egg yolk", "Spinach and methi", "Ragi", "Jaggery", "Chana"],
    watch: "One or two eggs a day suit most women; boiled or bhurji beats fried.",
    day: { Breakfast: "Masala omelette with toast", Lunch: "Rajma bowl", "Evening snack": "Boiled egg chaat", Dinner: "Egg curry with roti" },
  },
  "Non-vegetarian": {
    line: "Chicken, fish and eggs are rich in protein, iron and B12.",
    protein: ["Chicken", "Fish", "Eggs", "Mutton (sometimes)", "Dal and curd"],
    iron: ["Mutton and liver", "Fish", "Egg yolk", "Spinach", "Ragi"],
    watch: "Choose curry, grilled or tandoori over deep-fried; keep red meat to once or twice a week.",
    day: { Breakfast: "Egg bhurji with roti", Lunch: "Fish curry with rice", "Evening snack": "Chicken and vegetable soup", Dinner: "Chicken tikka with salad" },
  },
  Vegan: {
    line: "Pulses, soya and nuts carry your protein without dairy.",
    protein: ["Dal and rajma", "Chana and sprouts", "Soya and tofu", "Peanuts", "Seeds"],
    iron: ["Spinach and methi", "Ragi", "Jaggery", "Chana", "Dates"],
    watch: "Ask your doctor about vitamin B12 — it is hard to get from plants alone.",
    day: { Breakfast: "Vegetable poha", Lunch: "Chana masala with rice", "Evening snack": "Roasted makhana", Dinner: "Vegetable khichdi" },
  },
};

/* ── pictures for the step flows (names are keys of ART in ../art.ts) ── */

/** Diet types as picture tiles, with a short line saying what each means. */
export const DIET_TILES: { value: HealthSettings["diet"]; label: string; art: string; sub: string }[] = [
  { value: "Vegetarian", label: "Vegetarian", art: "Vegetarian", sub: "No meat or eggs" },
  { value: "Eggetarian", label: "Eggetarian", art: "Eggetarian", sub: "Vegetarian, plus eggs" },
  { value: "Non-vegetarian", label: "Non-vegetarian", art: "Non-vegetarian", sub: "Meat, fish and eggs" },
  { value: "Vegan", label: "Vegan", art: "Vegan", sub: "No dairy, eggs or meat" },
];

/** A picture for each nutrition goal on the Goals tab. */
export const GOAL_ART: Record<string, string> = {
  "Eat on time": "Reminder", "More protein": "More protein", "More iron": "More iron", "Lose weight gently": "Weight management",
  "Gain strength": "Strength", "Manage sugar": "Low sugar", "Eat more vegetables": "Balanced meals",
};

export const FACTORS = ["Caffeine late", "Screen in bed", "Stress", "Late meal", "Noise", "Pain", "Woke for baby", "Exercise today"];

/** A picture for each thing that can affect a night's sleep. */
export const FACTOR_ART: Record<string, string> = {
  "Caffeine late": "Lifestyle", "Screen in bed": "Online", Stress: "Mental health professional", "Late meal": "Meal",
  Noise: "Custom", Pain: "Cramps", "Woke for baby": "Pediatrician", "Exercise today": "Workout",
};

/** Sleep quality as faces, from the approved design. */
export const QUALITY_TILES = [
  { value: "Poor", label: "Poor", art: "Restless", sub: "Woke a lot" },
  { value: "Fair", label: "Fair", art: "Okay", sub: "On and off" },
  { value: "Good", label: "Good", art: "Good", sub: "Mostly rested" },
  { value: "Great", label: "Great", art: "Restful", sub: "Woke refreshed" },
] as const;

export const SLEEP_TIPS = [
  "Keep your room dark, cool and quiet.",
  "Avoid tea or coffee after 4 pm.",
  "Try a short wind-down routine before bed.",
  "Get morning daylight to set your body clock.",
];

export const DEFAULT_ROUTINE = ["Dim the lights", "Put my phone away", "Wash up and change", "Read or stretch for 10 minutes"];

/** Large photos for recipe cards — the library's kitchen pictures, rotated. */
export const FOOD_ART = ["work-dashboard-kitchen", "earn-kitchen", "course-cooking-packing-orders"].map((n) => `/ux/art/${n}.webp`);
export const recipeArt = (r: Recipe) => FOOD_ART[RECIPES.indexOf(r) % FOOD_ART.length];

export const recipeFor = (id: string) => RECIPES.find((r) => r.id === id);
