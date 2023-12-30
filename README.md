# latex2svg-service

A small online service to convert a LaTeX document to SVG, using Bun, Elysia, texlive.net and `pdf2svg`.

This is mainly intended for internal usage in a company, so it's run on a pretty small machine and I don't want to pay too much for this. Hence an API key is required to prevent over-use. If you want an API key, feel free to contact me@joulev.dev.

```ts
const texContent = `
\\documentclass[tikz]{standalone}
\\begin{document}
\\begin{tikzpicture}
  \\draw (0,0) circle (1cm);
\\end{tikzpicture}
\\end{document}
`.trimStart();

const res = await fetch("https://latex2svg.joulev.dev/v1", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ fileContent: texContent }),
});
const svg = await res.text();
// <svg xmlns="http://www.w3.org/2000/svg" ...
```

The endpoint accepts JSON requests of type

```ts
interface BodySchema {
  fileContent: string;
}
```

The file will then be run on `pdflatex`.

The endpoint always returns textual response so `res.text()` is safe.

If the compilation succeeds, the `Content-Type` of the response is set to `image/svg+xml` with the text response being the SVG code.

If the compilation fails with an error, the 400 status code is used with `Content-Type` being `text/plain` and the response being the compilation log. You may want to let the user know this log content for them to debug the compilation error.
