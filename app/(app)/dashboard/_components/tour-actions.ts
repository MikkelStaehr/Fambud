'use server';

import { revalidatePath } from 'next/cache';
import { markTourCompleted } from '@/lib/dal';

// Server-action der kaldes når brugeren klikker "Færdig" eller "Spring
// over" i dashboard-touren. Sætter tour_completed_at så turen ikke
// genstartes ved næste login.
export async function completeTour() {
  await markTourCompleted();
  revalidatePath('/dashboard');
}
