export function selectWeeklyWorkout(adminWorkouts, assignment) {
  if (!assignment?.workout_id) return null;
  return adminWorkouts.find((workout) => workout.id === assignment.workout_id) ?? null;
}
