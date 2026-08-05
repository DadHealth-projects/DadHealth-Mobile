import { useCallback, useEffect, useMemo, useState } from 'react';

import { trackEvent } from '../lib/analytics';
import { supabase } from '../lib/supabase';

export type RecipeDifficulty = 'easy' | 'medium';
export type RecipeStep = { title?: string; instruction: string; kid_instruction?: string };
export type CookTogetherRecipe = {
  id: string;
  title: string;
  description: string | null;
  difficulty: RecipeDifficulty;
  age_min: number;
  prep_mins: number;
  ingredients: string[];
  steps: RecipeStep[];
  image_url: string | null;
};

type Filters = { difficulty: 'all' | RecipeDifficulty; maxMins: 'all' | number };

function strings(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function steps(value: unknown): RecipeStep[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === 'string') return [{ instruction: item }];
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    if (typeof row.instruction !== 'string' || !row.instruction) return [];
    return [{
      instruction: row.instruction,
      title: typeof row.title === 'string' ? row.title : undefined,
      kid_instruction: typeof row.kid_instruction === 'string' ? row.kid_instruction : undefined,
    }];
  });
}

export function useCookTogetherRecipes(userId?: string) {
  const [allRecipes, setAllRecipes] = useState<CookTogetherRecipe[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [bondScore, setBondScore] = useState<number | null>(null);
  const [filters, setFilters] = useState<Filters>({ difficulty: 'all', maxMins: 'all' });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [recipeResult, savedResult, scoreResult, completedResult] = await Promise.all([
      supabase.from('recipes').select('*').eq('cook_together', true).order('prep_mins', { ascending: true }),
      userId ? supabase.from('user_saved_recipes').select('recipe_id').eq('user_id', userId) : Promise.resolve({ data: [], error: null }),
      userId ? supabase.from('dad_score_view').select('bond_score').eq('user_id', userId).maybeSingle() : Promise.resolve({ data: null, error: null }),
      userId ? supabase.from('bond_logs').select('recipe_id').eq('user_id', userId).eq('activity_type', 'cook_together_recipe').not('recipe_id', 'is', null) : Promise.resolve({ data: [], error: null }),
    ]);
    if (recipeResult.error || savedResult.error) {
      setError('Cook Together recipes are unavailable. Please try again.');
    } else {
      setAllRecipes((recipeResult.data ?? []).map((row: Record<string, unknown>) => ({
        id: String(row.id),
        title: String(row.title ?? 'Untitled recipe'),
        description: typeof row.description === 'string' ? row.description : null,
        difficulty: row.difficulty === 'medium' ? 'medium' : 'easy',
        age_min: Number(row.age_min ?? 0),
        prep_mins: Number(row.prep_mins ?? 0),
        ingredients: strings(row.ingredients),
        steps: steps(row.steps),
        image_url: typeof row.image_url === 'string' ? row.image_url : null,
      })));
      setSavedIds(new Set((savedResult.data ?? []).map((row: { recipe_id: string }) => row.recipe_id)));
      setCompletedIds(new Set((completedResult.data ?? []).flatMap((row: { recipe_id: string | null }) => row.recipe_id ? [row.recipe_id] : [])));
      setBondScore(typeof scoreResult.data?.bond_score === 'number' ? scoreResult.data.bond_score : null);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const recipes = useMemo(() => allRecipes.filter((recipe) =>
    (filters.difficulty === 'all' || recipe.difficulty === filters.difficulty)
    && (filters.maxMins === 'all' || recipe.prep_mins <= filters.maxMins)), [allRecipes, filters]);

  const toggleSaved = useCallback(async (recipeId: string) => {
    if (!userId) return { error: 'Log in to save recipes.' };
    setBusyId(recipeId);
    const saved = savedIds.has(recipeId);
    const result = saved
      ? await supabase.from('user_saved_recipes').delete().eq('user_id', userId).eq('recipe_id', recipeId)
      : await supabase.from('user_saved_recipes').insert({ user_id: userId, recipe_id: recipeId });
    setBusyId(null);
    if (result.error) return { error: 'We could not update this saved recipe.' };
    trackEvent(saved ? 'cook_together_recipe_unsaved' : 'cook_together_recipe_saved', { recipe_id: recipeId }, userId);
    await refresh();
    return { error: null };
  }, [refresh, savedIds, userId]);

  const complete = useCallback(async (recipe: CookTogetherRecipe) => {
    if (!userId) return { error: 'Log in to complete a recipe.' };
    setBusyId(recipe.id);
    const { error: completeError } = await supabase.rpc('complete_cook_together_recipe', { p_recipe_id: recipe.id });
    setBusyId(null);
    if (completeError) return { error: 'We could not mark this recipe complete.' };
    trackEvent('cook_together_recipe_completed', { recipe_id: recipe.id, difficulty: recipe.difficulty, prep_mins: recipe.prep_mins }, userId);
    await refresh();
    return { error: null };
  }, [refresh, userId]);

  return { recipes, savedIds, completedIds, bondScore, filters, setFilters, loading, busyId, error, refresh, toggleSaved, complete };
}
