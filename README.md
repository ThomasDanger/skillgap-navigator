# SkillGap Navigator

Explore the latest available UN SDG 4.4.1 national indicators for a selected
country, see the five highest and lowest reported values, and request a
beginner-friendly learning suggestion for one topic.

## Run locally

```sh
npm install
npm run dev
```

The development command starts Vite and the API server together. Open the Vite
URL printed in the terminal.

## Configure the model endpoint

The app's `POST /api/recommendations` endpoint supports Google's Gemini
Interactions API, Gemini `generateContent`, and OpenAI-compatible chat
completions APIs. For `gemini-3.5-flash-lite`, copy `.env.example` to `.env`
and set:

- `MODEL_API_URL`: full model endpoint URL
- `MODEL_API_KEY`: secret API key (server-side only; never use a `VITE_` prefix)
- `MODEL_NAME`: model identifier accepted by that provider

For Gemini 3.5 Flash-Lite, use this exact model endpoint:

```env
MODEL_API_URL=https://generativelanguage.googleapis.com/v1beta/interactions
MODEL_NAME=gemini-3.5-flash-lite
```

The key is only read by the server and is not sent to the browser. Without
these settings, country rankings work, but recommendation requests return a
clear configuration error. Gemini calls use Google's request format and the
`x-goog-api-key` header. OpenAI-compatible calls use bearer authentication.
Provider error messages are returned by the app to help diagnose invalid
endpoint/model settings. The endpoint accepts
`{ "countryCode": "...", "skillCode": "..." }`; it verifies both against the
bundled dataset and derives the latest reported value server-side before asking
the model for a suggestion.

For production, run `npm run build`, then `npm start`. The server serves both
the built app and the API. Set the model variables in the hosting environment.

## Data interpretation

Country rankings use the latest year available with at least five indicators
for that country (or its latest available year if fewer than five are
available), using the dataset's `ALLAGE`, `BOTHSEX`, and `ALLAREA` filters.
The app ranks only indicators reported in that same year; missing values are
not filled or estimated. These are national activity percentages, not
measurements of an individual's abilities. The lowest values are not evidence
that an individual needs training.

Run the local checks with `npm test`, `npm run lint`, and `npm run build`.
