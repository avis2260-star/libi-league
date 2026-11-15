# Site fonts (self-hosted)

The site's three fonts are stored here and loaded with `next/font/local`
(see `src/app/layout.tsx`), so a build never has to download anything from
Google Fonts — a failed download used to stop Vercel builds.

| File | Family | Weights (variable) | Characters |
|---|---|---|---|
| `Heebo-Variable.woff2` | Heebo | 100–900 | Hebrew + Latin |
| `Assistant-Variable.woff2` | Assistant | 200–800 | Hebrew + Latin |
| `Teko-Variable.woff2` | Teko | 300–700 | Latin |

Made from the official variable fonts in the google/fonts repository
(`ofl/heebo/Heebo[wght].ttf`, `ofl/assistant/Assistant[wght].ttf`,
`ofl/teko/Teko[wght].ttf`), trimmed to the same Hebrew / Latin character
ranges Google Fonts serves for those subsets, with fontTools:

```sh
pyftsubset "Heebo[wght].ttf" --unicodes="<hebrew>,<latin>" --layout-features='*' --flavor=woff2 --output-file=Heebo-Variable.woff2
```

- hebrew: `U+0307-0308,U+0590-05FF,U+200C-2010,U+20AA,U+25CC,U+FB1D-FB4F`
- latin: `U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD`

All three are licensed under the SIL Open Font License 1.1 (`OFL-*.txt`).
