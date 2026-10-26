const DATA_URL = "/Data/SkillGap-data/sdgData.json";
const DEFAULT_FILTERS = {
  age: "ALLAGE",
  sex: "BOTHSEX",
  location: "ALLAREA",
};

export async function loadSDGData() {
  const response = await fetch(DATA_URL);

  if (!response.ok) {
    throw new Error(`Unable to load UN SDG data (HTTP ${response.status}).`);
  }

  const data = await response.json();

  if (
    !Array.isArray(data.observations) ||
    !Array.isArray(data.countries) ||
    !Array.isArray(data.skills)
  ) {
    throw new Error("Invalid UN SDG data format.");
  }

  return data;
}

export function getCountrySnapshot(data, countryCode) {
  const skillLabels = new Map(data.skills.map((skill) => [skill.code, skill.label]));
  const countryObservations = data.observations.filter(
    (observation) =>
      observation.countryCode === countryCode &&
      observation.age === DEFAULT_FILTERS.age &&
      observation.sex === DEFAULT_FILTERS.sex &&
      observation.location === DEFAULT_FILTERS.location &&
      Number.isFinite(observation.value)
  );

  const observationCountByYear = new Map();
  for (const observation of countryObservations) {
    observationCountByYear.set(
      observation.year,
      (observationCountByYear.get(observation.year) ?? 0) + 1
    );
  }
  const yearsWithFiveIndicators = [...observationCountByYear]
    .filter(([, count]) => count >= 5)
    .map(([year]) => year);
  const year = yearsWithFiveIndicators.length
    ? Math.max(...yearsWithFiveIndicators)
    : Math.max(...observationCountByYear.keys());
  if (!Number.isFinite(year)) {
    return { year: null, skills: [], mostPrevalent: [], leastPrevalent: [] };
  }

  const latestObservations = countryObservations.filter(
    (observation) => observation.year === year
  );
  const skills = latestObservations
    .map((observation) => ({
      skillCode: observation.skillCode,
      skill: skillLabels.get(observation.skillCode) ?? observation.skillCode,
      value: observation.value,
      year,
    }))
    .sort((a, b) => a.skill.localeCompare(b.skill));

  return {
    year,
    skills,
    mostPrevalent: [...skills]
      .sort((a, b) => b.value - a.value || a.skill.localeCompare(b.skill))
      .slice(0, 5),
    leastPrevalent: [...skills]
      .sort((a, b) => a.value - b.value || a.skill.localeCompare(b.skill))
      .slice(0, 5),
  };
}
