import {libraryRequest} from './library';
import {summarizeGroceryAndPantry} from './groceryChecklist';
import {compactMeals,compactPurchases,compactWorkouts,type AppSnapshot} from './assistantActionsModel';

/** Labs: the owner's own current app data, read just before sending, so the assistant can see it
 *  and name exact records. Each part that fails to load is marked unavailable, never guessed. */
export async function currentAppState():Promise<AppSnapshot>{
  const now=Date.now(),day=(offset:number)=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago'}).format(new Date(now+offset*864e5));
  type Row=Record<string,unknown>;
  const [plan,meals,workouts,purchases,settings]=await Promise.allSettled([
    libraryRequest<{plan:{meal_plan?:unknown;workout_template?:unknown}}>({action:'coach_plan_get'}),
    libraryRequest<{meals?:Row[]}>({action:'food_list',limit:12}),
    libraryRequest<{entries?:Row[]}>({action:'exercise_list',start:new Date(now-7*864e5).toISOString(),end:new Date(now+6e5).toISOString(),limit:100}),
    libraryRequest<{links?:Row[]}>({action:'reconcile_list',start:day(-14),end:day(0)}),
    libraryRequest<{settings?:Row}>({action:'food_settings_get'})]);
  const gone='(could not be read just now)';
  const rawMeals=meals.status==='fulfilled'?meals.value.meals||[]:[];
  const rawMealPlan=plan.status==='fulfilled'?plan.value.plan?.meal_plan??null:null;
  const groceryText=rawMealPlan&&typeof rawMealPlan==='object'&&!Array.isArray(rawMealPlan)&&typeof (rawMealPlan as Row).groceries==='string'?(rawMealPlan as Row).groceries as string:'';
  const kitchen=summarizeGroceryAndPantry(groceryText,rawMeals as {description?:string;consumedAt?:string|null;createdAt?:string}[]);
  const hasKitchen=kitchen.activeShoppingList.totalCount>0||kitchen.activeShoppingList.notes.length>0||kitchen.pantry.stocked.length>0||kitchen.pantry.runningLow.length>0;
  const mealPlanValue=plan.status==='fulfilled'
    ?(rawMealPlan&&typeof rawMealPlan==='object'&&!Array.isArray(rawMealPlan)
      ?(hasKitchen?{...(rawMealPlan as Row),activeShoppingList:kitchen.activeShoppingList,pantry:kitchen.pantry}:rawMealPlan)
      :(hasKitchen?{activeShoppingList:kitchen.activeShoppingList,pantry:kitchen.pantry}:rawMealPlan))
    :(hasKitchen?{planStatus:gone,pantry:kitchen.pantry}:gone);
  return{nutritionSettings:settings.status==='fulfilled'?{calorieTarget:settings.value.settings?.calorieTarget??null,since:settings.value.settings?.effectiveFrom??null}:gone,recentMeals:meals.status==='fulfilled'?compactMeals(rawMeals):gone,
    recentWorkouts:workouts.status==='fulfilled'?compactWorkouts(workouts.value.entries||[]):gone,
    purchases:purchases.status==='fulfilled'?compactPurchases(purchases.value.links||[]):gone,
    mealPlan:mealPlanValue,
    workoutPlan:plan.status==='fulfilled'?plan.value.plan?.workout_template??null:gone};
}
