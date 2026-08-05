export type TDEEGender = 'male' | 'female';
export type TDEEActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

export const ACTIVITY_LABELS: Record<TDEEActivityLevel, string> = {
  sedentary: 'Sedentary (little or no exercise)',
  light: 'Lightly active (1-3 days/week)',
  moderate: 'Moderately active (3-5 days/week)',
  active: 'Very active (6-7 days/week)',
  very_active: 'Extra active (physical job or 2x training)',
};

const ACTIVITY_MULTIPLIERS: Record<TDEEActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export type TDEEResult = {
  bmr: number;
  tdee: number;
  maintenance: number;
  fatLoss: number;
  aggressiveFatLoss: number;
  muscleGain: number;
  bmi: number;
  bmiCategory: string;
};

export function calculateTDEE({ age, weightKg, heightCm, gender, activityLevel }: {
  age: number;
  weightKg: number;
  heightCm: number;
  gender: TDEEGender;
  activityLevel: TDEEActivityLevel;
}): TDEEResult {
  const bmr = gender === 'male'
    ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
    : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
  const tdee = Math.round(bmr * ACTIVITY_MULTIPLIERS[activityLevel]);
  const bmi = weightKg / ((heightCm / 100) ** 2);
  const roundedBmi = Math.round(bmi * 10) / 10;
  const bmiCategory = bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Healthy weight' : bmi < 30 ? 'Overweight' : 'Obese';

  return {
    bmr: Math.round(bmr),
    tdee,
    maintenance: tdee,
    fatLoss: Math.round(tdee - 500),
    aggressiveFatLoss: Math.round(tdee - 750),
    muscleGain: Math.round(tdee + 300),
    bmi: roundedBmi,
    bmiCategory,
  };
}

export const lbsToKg = (lbs: number) => Math.round(lbs * 0.4536 * 10) / 10;
export const ftInchesToCm = (feet: number, inches: number) => Math.round(feet * 30.48 + inches * 2.54);
