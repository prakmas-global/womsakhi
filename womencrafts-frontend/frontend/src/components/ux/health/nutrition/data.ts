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

export const DIETS: HealthSettings["diet"][] = ["Vegetarian", "Eggetarian", "Non-vegetarian", "Vegan", "Jain"];
const ALL = DIETS;

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
  { id: "ragi", name: "Ragi porridge", meal: "Breakfast", mins: 15, kcal: 220, protein: 7, suits: ["Vegetarian", "Eggetarian", "Non-vegetarian", "Jain"], tags: ["Calcium", "Iron"],
    ing: ["3 tbsp ragi flour", "1 cup milk", "1 cup water", "Jaggery to taste", "A pinch of cardamom"],
    steps: ["Mix the ragi flour into the water with no lumps.", "Cook on low heat, stirring, for 5 minutes.", "Add milk and cook 3 more minutes.", "Sweeten with jaggery and cardamom."] },
  { id: "palak", name: "Palak dal with rice", meal: "Lunch", mins: 35, kcal: 420, protein: 16, suits: ["Vegetarian", "Eggetarian", "Non-vegetarian", "Vegan"], tags: ["Iron", "High protein"],
    ing: ["½ cup toor dal", "2 cups chopped spinach", "Garlic, tomato, cumin", "Cooked rice"],
    steps: ["Pressure-cook the dal until soft.", "Fry cumin and garlic, then add tomato and spinach.", "Mix in the dal and simmer for 5 minutes.", "Serve hot with rice."] },
  { id: "rajma", name: "Rajma bowl", meal: "Lunch", mins: 40, kcal: 450, protein: 17, suits: ["Vegetarian", "Eggetarian", "Non-vegetarian", "Vegan"], tags: ["Fibre", "High protein"],
    ing: ["1 cup soaked rajma", "Onion, tomato, ginger-garlic", "Rajma masala", "Rice or roti"],
    steps: ["Pressure-cook the rajma until soft.", "Cook onion, ginger-garlic and tomato into a thick masala.", "Add the rajma and simmer for 10 minutes.", "Serve with rice or roti and a salad."] },
  { id: "curdrice", name: "Curd rice with pomegranate", meal: "Lunch", mins: 15, kcal: 330, protein: 9, suits: ["Vegetarian", "Eggetarian", "Non-vegetarian", "Jain"], tags: ["Cooling"],
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
];

export const FACTORS = ["Caffeine late", "Screen in bed", "Stress", "Late meal", "Noise", "Pain", "Woke for baby", "Exercise today"];

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
