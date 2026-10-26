"""Rebuild from the original UN workbook; requires openpyxl for reading only."""
import openpyxl,json,collections,hashlib,pathlib,sys
p=pathlib.Path(__file__).parent
src=pathlib.Path(sys.argv[1] if len(sys.argv)>1 else 'input/Copia de Goal4.xlsx')
w=openpyxl.load_workbook(src,read_only=True,data_only=True)
it=w['data'].values; headers=next(it)[:24]
raw=[dict(zip(headers,r[:24])) for r in it]
maps={}
for r in list(w['CodeDescriptions'].values)[1:]:
 if r[0]:maps.setdefault(r[0],{})[str(r[1])]=str(r[2]).strip()
fields={'GeoAreaCode':'countryCode','TimePeriod':'year','Type of skill':'skillCode','Age':'age','Sex':'sex','Location':'location','Nature':'nature','Reporting Type':'reportingType','Value':'value','Time_Detail':'timeDetail','TimeCoverage':'timeCoverage','UpperBound':'upperBound','LowerBound':'lowerBound','BasePeriod':'basePeriod','GeoInfoUrl':'geoInfoUrl','FootNote':'footnote'}
countries={};sources=[]; observations=[]; rejected=[]
for i,r in enumerate(raw,2):
 if r['Indicator']!='4.4.1' or not 2020<=int(r['TimePeriod'])<=2025:continue
 try:
  value=float(r['Value'])
  assert 0<=value<=100
 except (ValueError,TypeError,AssertionError):
  rejected.append({'sourceRow':i,'value':r['Value']});continue
 code=str(r['GeoAreaCode']).zfill(3);countries[code]=r['GeoAreaName']
 if r['Source'] not in sources:sources.append(r['Source'])
 o={new:r[old] for old,new in fields.items() if r[old] not in ('',None)}
 o.update(countryCode=code,year=int(r['TimePeriod']),value=value,sourceId=sources.index(r['Source']),sourceRow=i)
 observations.append(o)
keys=lambda o:tuple(o.get(k) for k in ['countryCode','year','skillCode','age','sex','location','nature','reportingType'])
assert len(set(map(keys,observations)))==len(observations)
skills=sorted(set(o['skillCode'] for o in observations))
assert all(s in maps['Type of skill'] for s in skills)
data={'schemaVersion':1,'metadata':{'indicator':'4.4.1','seriesCode':'SE_ADT_ACTS','seriesDescription':raw[0]['SeriesDescription'],'unit':'PERCENT','sourceFile':src.name,'sourceSha256':hashlib.sha256(src.read_bytes()).hexdigest(),'portal':'https://unstats.un.org/sdgs/dataportal','requestedYears':[2020,2025],'defaultFilters':{'age':'ALLAGE','sex':'BOTHSEX','location':'ALLAREA'},'nature':'C','reportingType':'G'},'countries':[{'code':c,'name':n} for c,n in sorted(countries.items(),key=lambda x:x[1])],'skills':[{'code':s,'label':maps['Type of skill'][s]} for s in skills],'dimensions':maps,'sources':sources,'observations':observations}
report={'inputRows':len(raw),'outputRows':len(observations),'rejected':rejected,'duplicateKeys':0,'geographicAreas':len(countries),'skills':len(skills),'byYear':dict(sorted(collections.Counter(o['year'] for o in observations).items())),'defaultFilterRows':sum(all(o[k]==v for k,v in data['metadata']['defaultFilters'].items()) for o in observations),'missingSkillLabels':[]}
(p/'sdgData.json').write_text(json.dumps(data,separators=(',',':'),ensure_ascii=False))
(p/'validation.json').write_text(json.dumps(report,indent=2))
(p/'catalog.json').write_text(json.dumps({k:data[k] for k in ['countries','skills','dimensions']},indent=2,ensure_ascii=False))
print(json.dumps(report,indent=2))
