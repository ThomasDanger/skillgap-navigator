import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpen, GraduationCap, Sparkles } from "lucide-react";
import { getCountrySnapshot, loadSDGData } from "./utils/dataUtils";

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedSkill, setSelectedSkill] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [recommendationError, setRecommendationError] = useState("");
  const [loadingRecommendation, setLoadingRecommendation] = useState(false);
  const [modelStatus, setModelStatus] = useState("checking");

  useEffect(() => {
    loadSDGData()
      .then((dataset) => {
        const firstCountry = [...dataset.countries].sort((a, b) =>
          a.name.localeCompare(b.name)
        )[0];
        setData(dataset);
        setSelectedCountry(firstCountry?.code ?? "");
        setSelectedSkill(
          getCountrySnapshot(dataset, firstCountry?.code ?? "")
            .skills[0]?.skillCode ?? ""
        );
      })
      .catch((loadError) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load UN SDG data."
        );
      });

    fetch("/api/status")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            `Unable to check recommendation endpoint (HTTP ${response.status}).`
          );
        }
        const status = await response.json();
        setModelStatus(
          status.recommendationModelConfigured ? "configured" : "unconfigured"
        );
      })
      .catch(() => setModelStatus("unavailable"));
  }, []);

  const countries = useMemo(
    () => (data ? [...data.countries].sort((a, b) => a.name.localeCompare(b.name)) : []),
    [data]
  );
  const snapshot = useMemo(
    () => (data && selectedCountry ? getCountrySnapshot(data, selectedCountry) : null),
    [data, selectedCountry]
  );

  async function requestRecommendation(event) {
    event.preventDefault();
    if (!selectedCountry || !selectedSkill) return;

    setLoadingRecommendation(true);
    setRecommendation("");
    setRecommendationError("");

    try {
      const response = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countryCode: selectedCountry,
          skillCode: selectedSkill,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to create a learning recommendation.");
      }

      setRecommendation(result.recommendation);
    } catch (requestError) {
      setRecommendationError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to create a learning recommendation."
      );
    } finally {
      setLoadingRecommendation(false);
    }
  }

  if (error) {
    return <Notice tone="error">{error}</Notice>;
  }
  if (!data) {
    return <Notice>Loading UN SDG data...</Notice>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-6xl space-y-8 p-6">
        <header className="rounded-2xl bg-gradient-to-r from-blue-700 to-indigo-700 p-8 text-white">
          <div className="flex items-center gap-3">
            <GraduationCap size={36} aria-hidden="true" />
            <h1 className="text-3xl font-bold">SkillGap Navigator</h1>
          </div>
          <p className="mt-3 max-w-2xl text-blue-100">
            Explore reported digital skill activity in your country, then choose
            a topic to get a practical starting point for learning.
          </p>
          <span className="mt-5 inline-block rounded-full bg-white/20 px-4 py-2 text-sm">
            UN Sustainable Development Goal 4.4
          </span>
        </header>

        <section className="rounded-xl bg-white p-6 shadow-sm">
          <label htmlFor="country" className="mb-2 block font-semibold">
            Choose your country
          </label>
          <select
            id="country"
            value={selectedCountry}
            onChange={(event) => {
              const countryCode = event.target.value;
              setSelectedCountry(countryCode);
              setSelectedSkill(
                getCountrySnapshot(data, countryCode).skills[0]?.skillCode ?? ""
              );
              setRecommendation("");
              setRecommendationError("");
            }}
            className="w-full rounded-lg border border-slate-300 bg-white p-3"
          >
            {countries.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name}
              </option>
            ))}
          </select>
          {snapshot && (
            <p className="mt-3 text-sm text-slate-600">
              Showing the latest year with at least five reported indicators,
              when available ({snapshot.year}), for all ages, both sexes, and
              all areas. {snapshot.skills.length} indicators are available.
            </p>
          )}
        </section>

        {snapshot?.skills.length > 0 ? (
          <>
            <div className="grid gap-6 lg:grid-cols-2">
              <SkillList
                title="Top 5 most prevalent reported activities"
                description="Up to five indicators with the highest reported values."
                skills={snapshot.mostPrevalent}
                variant="high"
              />
              <SkillList
                title="Top 5 least prevalent reported activities"
                description="Up to five indicators with the lowest reported values."
                skills={snapshot.leastPrevalent}
                variant="low"
              />
            </div>

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-3">
                <BookOpen className="text-blue-600" aria-hidden="true" />
                <div>
                  <h2 className="text-2xl font-bold">Choose a topic to explore</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Pick one reported skill indicator to get a beginner-friendly
                    learning suggestion.
                  </p>
                </div>
              </div>
              <form onSubmit={requestRecommendation} className="space-y-4">
                {modelStatus === "unconfigured" && (
                  <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
                    The recommendation model is not configured yet. Country
                    statistics remain available; configure the server model
                    settings to enable suggestions.
                  </p>
                )}
                {modelStatus === "unavailable" && (
                  <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
                    The recommendation API is unavailable. Country statistics
                    remain available; restart the app server and try again.
                  </p>
                )}
                <label htmlFor="topic" className="block text-sm font-medium">
                  Topic of interest
                </label>
                <select
                  id="topic"
                  value={selectedSkill}
                  onChange={(event) => {
                    setSelectedSkill(event.target.value);
                    setRecommendation("");
                    setRecommendationError("");
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white p-3"
                >
                  {snapshot.skills.map((skill) => (
                    <option key={skill.skillCode} value={skill.skillCode}>
                      {skill.skill}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={!selectedSkill || loadingRecommendation}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Sparkles size={18} aria-hidden="true" />
                  {loadingRecommendation ? "Creating suggestion..." : "Get a learning suggestion"}
                  {!loadingRecommendation && <ArrowRight size={18} aria-hidden="true" />}
                </button>
              </form>

              {recommendationError && (
                <p role="alert" className="mt-5 rounded-lg bg-amber-50 p-4 text-amber-900">
                  {recommendationError}
                </p>
              )}
              {recommendation && (
                <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 p-5">
                  <h3 className="font-semibold text-blue-950">A place to start</h3>
                  <p className="mt-2 whitespace-pre-wrap text-blue-950">{recommendation}</p>
                </div>
              )}
            </section>
          </>
        ) : (
          <section className="rounded-xl bg-white p-6 text-slate-700 shadow-sm">
            No observations are available for this country in the dataset snapshot.
          </section>
        )}

        <section className="rounded-xl border border-blue-100 bg-blue-50 p-6 text-sm text-blue-950">
          <h2 className="mb-2 text-lg font-semibold">About these statistics</h2>
          <p>
            These are national percentages for reported activities, not a measure
            of your personal ability. “Least prevalent” means the lowest
            reported value among the available indicators; it does not mean
            people in that country lack the skill. Coverage varies by country,
            year, and indicator. Learning suggestions are general starting
            points, not assessments or guarantees.
          </p>
        </section>
        <footer className="border-t py-6 text-center text-sm text-gray-500">
          Source: United Nations SDG Global Database, Indicator 4.4.1.
        </footer>
      </main>
    </div>
  );
}

function SkillList({ title, description, skills, variant }) {
  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="mb-4 mt-1 text-sm text-slate-600">{description}</p>
      <ol className="space-y-3">
        {skills.map((skill, index) => (
          <li
            key={skill.skillCode}
            className="flex items-start justify-between gap-4 rounded-lg border border-slate-100 p-4"
          >
            <div className="flex gap-3">
              <span className={`font-semibold ${variant === "high" ? "text-blue-700" : "text-indigo-700"}`}>
                {index + 1}.
              </span>
              <span className="text-sm font-medium">{skill.skill}</span>
            </div>
            <span className="shrink-0 font-semibold">{skill.value}%</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Notice({ children, tone }) {
  return (
    <div className={`p-10 text-center ${tone === "error" ? "text-red-700" : "text-slate-700"}`}>
      {children}
    </div>
  );
}
