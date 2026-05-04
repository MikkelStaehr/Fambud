'use server';

import { revalidatePath } from 'next/cache';
import { markTourCompleted, resetAllTours } from '@/lib/dal';

// Markér en specifik tour som gennemført. Kaldes fra PageTour når brugeren
// klikker "Færdig" eller "Spring over" på en hvilken som helst page-tour.
export async function completeTour(tourKey: string) {
  await markTourCompleted(tourKey);
  // Vi revaliderer ikke aktivt - PageTour skjuler sig selv via lokalt state
  // og næste page-load vil hente den nye tours_completed alligevel.
}

// Nuller alle tours - brugeren ser hver sides rundtur igen.
export async function resetTours() {
  await resetAllTours();
  revalidatePath('/', 'layout');
}
