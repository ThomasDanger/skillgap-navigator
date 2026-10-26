/** Dependency-free ES module. Missing data is null; never implicitly imputed. */
export const DEFAULT_FILTERS = Object.freeze({age:"ALLAGE",sex:"BOTHSEX",location:"ALLAREA"});
const required = ["skillCode","year"];
const normCode = code => String(code).padStart(3,"0");
export function filterObservations(data, filters = {}) {
  return data.observations.filter(o => Object.entries(filters).every(([k,v]) =>
    v === undefined || (k === "countryCode" ? o[k] === normCode(v) : o[k] === v)));
}
export function availableCountries(data, filters = {}) {
  const codes = new Set(filterObservations(data,filters).map(o=>o.countryCode));
  return data.countries.filter(c=>codes.has(c.code));
}
export function availableYears(data, filters = {}) {
  return [...new Set(filterObservations(data,filters).map(o=>o.year))].sort((a,b)=>a-b);
}
export function getObservation(data, countryCode, filters) {
  for (const k of required) if (filters?.[k] === undefined) throw new Error("Required filter: "+k);
  const matches=filterObservations(data,{...DEFAULT_FILTERS,...filters,countryCode:normCode(countryCode)});
  if(matches.length>1) throw new Error("Ambiguous observation; select all dimensions.");
  const observation=matches[0]??null;
  if(!observation) return null;
  return {...observation, country:data.countries.find(c=>c.code===observation.countryCode)?.name,
    skillLabel:data.skills.find(s=>s.code===observation.skillCode)?.label,
    source:data.sources[observation.sourceId],unit:data.metadata.unit};
}
/** Exact same year and demographic codes; national survey definitions can still differ. */
export function compareCountries(data, countryA, countryB, filters) {
  const a=getObservation(data,countryA,filters),b=getObservation(data,countryB,filters);
  return {a,b,status:a&&b?"matched":"missing-data",
    differencePercentagePoints:a&&b?a.value-b.value:null,
    notes:[a?.footnote,b?.footnote].filter(Boolean),
    comparabilityWarning:"Matching codes do not guarantee identical survey populations or methods. Review source notes and time coverage."};
}
/** Finds a common year, never separate latest years for the two countries. */
export function latestCommonYear(data,countryA,countryB,filters) {
  if(!filters?.skillCode) throw new Error("Required filter: skillCode");
  const rest=Object.fromEntries(Object.entries(filters).filter(([key])=>key!=="year"));
  const a=availableYears(data,{...DEFAULT_FILTERS,...rest,countryCode:normCode(countryA)});
  const b=new Set(availableYears(data,{...DEFAULT_FILTERS,...rest,countryCode:normCode(countryB)}));
  return a.filter(y=>b.has(y)).at(-1)??null;
}
/** Per-skill country differences; positive shortfall means A is below B. No overall score. */
export function skillGaps(data,countryA,countryB,filters) {
  if(filters?.year===undefined) throw new Error("Required filter: year");
  return data.skills.map(skill=>{
    const result=compareCountries(data,countryA,countryB,{...filters,skillCode:skill.code});
    return {skillCode:skill.code,skillLabel:skill.label,...result,
      shortfallPercentagePoints:result.a&&result.b?result.b.value-result.a.value:null};
  });
}
