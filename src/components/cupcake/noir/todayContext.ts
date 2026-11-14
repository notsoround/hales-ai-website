import { nutritionDay, nutritionDays, type NutritionHistory, type NutritionSettings } from '../nutritionModel';

/** Calories and protein still to go today, for the camera's info chips. Null when there is no target or no food log yet. */
export function todayFoodContext(history: NutritionHistory | null, settings: NutritionSettings, proteinGoalG = 150) {
  if (!history) return { caloriesLeft: null, proteinLeftG: null };
  const day = nutritionDays(history.meals, [nutritionDay()], settings)[0];
  if (!day) return { caloriesLeft: null, proteinLeftG: null };
  const protein = day.meals.reduce((sum, meal) => sum + (typeof meal.total?.protein_g === 'number' ? meal.total.protein_g : 0), 0);
  return { caloriesLeft: day.target !== null ? Math.max(0, Math.round(day.target - day.calories)) : null, proteinLeftG: Math.max(0, Math.round(proteinGoalG - protein)) };
}
