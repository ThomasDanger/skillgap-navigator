import fs from "node:fs";
import assert from "node:assert/strict";
import {getObservation,compareCountries,latestCommonYear,skillGaps} from "./dataUtils.js";
const d=JSON.parse(fs.readFileSync(new URL("./sdgData.json",import.meta.url)));
assert.equal(d.observations.length,60628);
assert.equal(d.countries.length,96);
for(const o of d.observations) {
 assert.ok(o.value>=0&&o.value<=100);
 assert.ok(d.skills.some(s=>s.code===o.skillCode));
 assert.ok(d.countries.some(c=>c.code===o.countryCode));
 assert.ok(d.sources[o.sourceId]!==undefined);
}
const known=getObservation(d,"008",{skillCode:"GSINF",year:2020,age:"15-24",sex:"FEMALE"});
assert.equal(known.value,64.5);
assert.equal(getObservation(d,"000",{skillCode:"GSINF",year:2020}),null);
assert.equal(compareCountries(d,"008","000",{skillCode:"GSINF",year:2020}).differencePercentagePoints,null);
assert.throws(()=>getObservation(d,"008",{skillCode:"GSINF"}));
const self=compareCountries(d,"008","008",{skillCode:"GSINF",year:2020,age:"15-24",sex:"FEMALE"});
assert.equal(self.differencePercentagePoints,0);
assert.equal(latestCommonYear(d,"008","000",{skillCode:"GSINF"}),null);
const fixture={...d,observations:[{countryCode:"001",year:2020,skillCode:"X",age:"ALLAGE",sex:"BOTHSEX",location:"ALLAREA",value:0,sourceId:0},{countryCode:"002",year:2020,skillCode:"X",age:"ALLAGE",sex:"BOTHSEX",location:"ALLAREA",value:10,sourceId:0}],skills:[{code:"X",label:"Test"}]};
assert.equal(compareCountries(fixture,"001","002",{year:2020,skillCode:"X"}).differencePercentagePoints,-10);
assert.equal(skillGaps(fixture,"001","002",{year:2020})[0].shortfallPercentagePoints,10);
console.log("PASS: dataset integrity, known value, zero versus missing, matching, gaps, required filters.");
