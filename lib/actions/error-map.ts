// Mapping af kendte Postgres-fejlmeddelelser til danske, brugbare
// brugervendte tekster. Vi får både UX (brugeren kan handle på fejlen)
// og security (raw error.message og constraint-/kolonne-navne lækkes
// ikke ind i URL'er).
//
// Brug:
//   if (error) {
//     console.error('createTransfer:', error.message); // log raw
//     redirect('/.../ny?error=' + encodeURIComponent(mapDbError(error, 'createTransfer')));
//   }

type DbError = { message?: string; code?: string };

export function mapDbError(error: DbError, fallback: string = 'Operationen fejlede - prøv igen'): string {
  const msg = error?.message ?? '';

  // Cross-household consistency triggers (migrations 0045, 0047)
  if (msg.includes('category does not belong to this household')) {
    return 'Kategorien hører ikke til jeres husstand - opdatér listen og prøv igen';
  }
  if (msg.includes('component household does not match')) {
    return 'Komponenten hører ikke til samme husstand som udgiften';
  }
  if (msg.includes('transfer accounts must belong to the same household')) {
    return 'Begge konti skal høre til jeres husstand';
  }

  // family_members guard (migration 0046)
  if (msg.includes('Only the household owner can change')) {
    return 'Kun husstands-ejeren kan ændre dette felt';
  }

  // Common Postgres constraints
  if (msg.includes('duplicate key value')) {
    if (msg.includes('email')) return 'Den email er allerede tilknyttet';
    if (msg.includes('name')) return 'Navnet er allerede i brug';
    return 'Der findes allerede en post med samme værdi';
  }
  if (msg.includes('violates not-null constraint')) {
    return 'Et påkrævet felt manglede';
  }
  if (msg.includes('check_violation') || msg.includes('violates check constraint')) {
    return 'Værdien er ikke gyldig - tjek felterne og prøv igen';
  }
  if (msg.includes('foreign key constraint') || msg.includes('foreign_key_violation')) {
    return 'Referencen findes ikke længere - opdatér siden';
  }
  if (msg.includes('value too long for type')) {
    return 'Et af felterne er for langt';
  }

  // Account-kind / ownership (vores egne errors fra account-validation)
  if (msg.includes('Operationen er ikke tilladt på denne kontotype')) {
    return msg;
  }
  if (msg.includes('Kontoen er arkiveret') || msg.includes('Kontoen findes ikke')) {
    return msg;
  }

  // Auth-relaterede
  if (msg.includes('User already registered')) {
    return 'Kontoen findes allerede';
  }
  if (msg.includes('Invalid login credentials')) {
    return 'Forkert email eller adgangskode';
  }
  if (msg.includes('Invalid or expired invite code')) {
    return 'Invitationen er udløbet eller findes ikke';
  }

  // Default fallback - ikke leak raw message
  return fallback;
}
