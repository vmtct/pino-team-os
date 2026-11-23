/** PAP-2242 · Pure Person candidate projection for the Workshop Participation picker. */
export type ParticipationPersonOption = {
  personId: string;
  fullName: string;
  age: number | null;
  phoneLast4: string | null;
};

export function personParticipationLabel(person: ParticipationPersonOption): string {
  const suffix = person.phoneLast4 && /^[0-9]{4}$/.test(person.phoneLast4) ? person.phoneLast4 : "—";
  return person.fullName + " - " + (person.age === null ? "—" : person.age + "t") + " - " + suffix;
}

function fold(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLocaleLowerCase("vi");
}

export function availableParticipationPeople(
  people: readonly ParticipationPersonOption[],
  participantPersonIds: readonly string[] = [],
  query = "",
): ParticipationPersonOption[] {
  const alreadyParticipating = new Set(participantPersonIds);
  const normalizedQuery = fold(query.trim());
  return people
    .filter(person => !alreadyParticipating.has(person.personId))
    .filter(person => !normalizedQuery || fold(personParticipationLabel(person)).includes(normalizedQuery))
    .slice(0, 3);
}
